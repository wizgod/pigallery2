import {promises as fsp, Stats} from 'fs';
import * as path from 'path';
import {
  ParentDirectoryDTO,
  SubDirectoryDTO,
} from '../../../common/entities/DirectoryDTO';
import {PhotoDTO} from '../../../common/entities/PhotoDTO';
import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import {VideoDTO} from '../../../common/entities/VideoDTO';
import {FileDTO} from '../../../common/entities/FileDTO';
import {MetadataLoader} from './MetadataLoader';
import {Logger} from '../../Logger';
import {VideoProcessing} from '../fileprocessing/VideoProcessing';
import {PhotoProcessing} from '../fileprocessing/PhotoProcessing';
import {Utils} from '../../../common/Utils';
import {GPXProcessing} from '../fileprocessing/GPXProcessing';
import {MediaDTOUtils} from "../../../common/entities/MediaDTO";

export class DiskMangerWorker {
  public static calcLastModified(stat: Stats): number {
    return Math.max(stat.ctime.getTime(), stat.mtime.getTime());
  }

  public static normalizeDirPath(dirPath: string): string {
    return path.normalize(path.join('.' + path.sep, dirPath));
  }

  public static pathFromRelativeDirName(relativeDirectoryName: string): string {
    return path.join(
      path.dirname(this.normalizeDirPath(relativeDirectoryName)),
      path.sep
    );
  }

  public static pathFromParent(parent: { path: string; name: string }): string {
    return path.join(
      this.normalizeDirPath(path.join(parent.path, parent.name)),
      path.sep
    );
  }

  public static dirName(dirPath: string): string {
    if (dirPath.trim().length === 0) {
      return '.';
    }
    return path.basename(dirPath);
  }

  public static async excludeDir(
    name: string,
    relativeDirectoryName: string,
    absoluteDirectoryName: string
  ): Promise<boolean> {
    if (
      Config.Indexing.excludeFolderList.length === 0 &&
      Config.Indexing.excludeFileList.length === 0
    ) {
      return false;
    }
    const absoluteName = path.normalize(path.join(absoluteDirectoryName, name));
    const relativeName = path.normalize(path.join(relativeDirectoryName, name));

    for (const exclude of Config.Indexing.excludeFolderList) {
      if (exclude.startsWith('/')) {
        if (exclude === absoluteName) {
          return true;
        }
      } else if (exclude.includes('/')) {
        if (path.normalize(exclude) === relativeName) {
          return true;
        }
      } else {
        if (exclude === name) {
          return true;
        }
      }
    }
    // exclude dirs that have the given files (like .ignore)
    for (const exclude of Config.Indexing.excludeFileList) {
      try {
        await fsp.access(path.join(absoluteName, exclude));
        return true;
      } catch (e) {
        // ignoring errors
      }
    }

    return false;
  }

  public static async scanDirectoryNoMetadata(
    relativeDirectoryName: string,
    settings: DirectoryScanSettings = {}
  ): Promise<ParentDirectoryDTO<FileDTO>> {
    settings.noMetadata = true;
    return (await this.scanDirectory(
      relativeDirectoryName,
      settings
    )) as ParentDirectoryDTO<FileDTO>;
  }

  public static async scanDirectory(
    relativeDirectoryName: string,
    settings: DirectoryScanSettings = {}
  ): Promise<ParentDirectoryDTO> {
    relativeDirectoryName = this.normalizeDirPath(relativeDirectoryName);
    const directoryName = DiskMangerWorker.dirName(relativeDirectoryName);
    const directoryParent = this.pathFromRelativeDirName(relativeDirectoryName);
    const absoluteDirectoryName = path.join(
      ProjectPath.ImageFolder,
      relativeDirectoryName
    );

    const stat = await fsp.stat(
      path.join(ProjectPath.ImageFolder, relativeDirectoryName)
    );
    const directory: ParentDirectoryDTO = {
      id: null,
      parent: null,
      name: directoryName,
      path: directoryParent,
      lastModified: this.calcLastModified(stat),
      lastScanned: Date.now(),
      directories: [],
      isPartial: false,
      mediaCount: 0,
      videoCount: 0,
      directoryCount: 0,
      cover: null,
      validCover: false,
      media: [],
      metaFile: [],
    };

    // nothing to scan, we are here for the empty dir
    if (
      settings.noPhoto === true &&
      settings.noMetaFile === true &&
      settings.noVideo === true
    ) {
      return directory;
    }
    const list = await fsp.readdir(absoluteDirectoryName);
    for (const file of list) {
      const fullFilePath = path.normalize(
        path.join(absoluteDirectoryName, file)
      );
      if ((await fsp.stat(fullFilePath)).isDirectory()) {
        directory.directoryCount++;

        if (
          settings.noDirectory === true ||
          settings.coverOnly === true ||
          (await DiskMangerWorker.excludeDir(
            file,
            relativeDirectoryName,
            absoluteDirectoryName
          ))
        ) {
          continue;
        }

        // create cover directory
        const d = (await DiskMangerWorker.scanDirectory(
          path.join(relativeDirectoryName, file),
          {
            coverOnly: true,
          }
        )) as SubDirectoryDTO;

        d.lastScanned = 0; // it was not a fully scanned
        d.isPartial = true;

        directory.directories.push(d);
      } else if (PhotoProcessing.isPhoto(fullFilePath)) {
        if (settings.noPhoto === true) {
          continue;
        }

        const photo = {
          name: file,
          directory: null,
          metadata:
            settings.noMetadata === true
              ? null
              : await MetadataLoader.loadPhotoMetadata(fullFilePath),
        } as PhotoDTO;

        if (!directory.cover) {
          directory.cover = Utils.clone(photo);

          directory.cover.directory = {
            path: directory.path,
            name: directory.name,
          };
        }
        // add the cover photo to the list of media, so it will be saved to the DB
        // and can be queried to populate covers,
        // otherwise we do not return media list that is only partial
        directory.media.push(photo);

        if (settings.coverOnly === true) {
          break;
        }
      } else if (VideoProcessing.isVideo(fullFilePath)) {
        if (
          Config.Media.Video.enabled === false ||
          settings.noVideo === true ||
          settings.coverOnly === true
        ) {
          continue;
        }
        try {
          directory.media.push({
            name: file,
            directory: null,
            metadata:
              settings.noMetadata === true
                ? null
                : await MetadataLoader.loadVideoMetadata(fullFilePath),
          } as VideoDTO);
        } catch (e) {
          Logger.warn(
            'Media loading error, skipping: ' +
            file +
            ', reason: ' +
            e.toString()
          );
        }
      } else if (GPXProcessing.isMetaFile(fullFilePath)) {
        if (
          !DiskMangerWorker.isEnabledMetaFile(fullFilePath) ||
          settings.noMetaFile === true ||
          settings.coverOnly === true
        ) {
          continue;
        }
        directory.metaFile.push({
          name: file,
          directory: null,
        } as FileDTO);
      }
    }

    directory.mediaCount = directory.media.length;
    directory.videoCount = directory.media.filter(q => MediaDTOUtils.isVideo(q))?.length;
    return directory;
  }


  private static isEnabledMetaFile(fullPath: string): boolean {
    const extension = path.extname(fullPath).toLowerCase();

    switch (extension) {
      case '.gpx':
        return Config.MetaFile.gpx;
      case '.md':
        return Config.MetaFile.markdown;
      case '.pg2conf':
        return Config.MetaFile.pg2conf;
    }

    return false;
  }
}

export interface DirectoryScanSettings {
  coverOnly?: boolean;
  noMetaFile?: boolean;
  noVideo?: boolean;
  noPhoto?: boolean;
  noDirectory?: boolean;
  noMetadata?: boolean; // skip parsing images for metadata like exif, iptc
  noChildDirPhotos?: boolean;
}
