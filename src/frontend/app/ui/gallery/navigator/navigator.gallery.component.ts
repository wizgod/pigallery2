import {Component, ElementRef, HostListener, ViewChild} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {DomSanitizer} from '@angular/platform-browser';
import {UserDTOUtils} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {QueryService} from '../../../model/query.service';
import {ContentService, ContentWrapperWithError, DirectoryContent,} from '../content.service';
import {Utils} from '../../../../../common/Utils';
import {SortingMethods} from '../../../../../common/entities/SortingMethods';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../common/entities/SearchQueryDTO';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {GallerySortingService} from './sorting.service';
import {PageHelper} from '../../../model/page.helper';
import {BsDropdownDirective} from 'ngx-bootstrap/dropdown';
import {FilterService} from '../filter/filter.service';

@Component({
  selector: 'app-gallery-navbar',
  styleUrls: ['./navigator.gallery.component.css'],
  templateUrl: './navigator.gallery.component.html',
  providers: [RouterLink],
})
export class GalleryNavigatorComponent {
  public SortingMethods = SortingMethods;
  public sortingMethodsType: { key: number; value: string }[] = [];
  public readonly config = Config;
  // DefaultSorting = Config.Gallery.defaultPhotoSortingMethod;
  public readonly SearchQueryTypes = SearchQueryTypes;
  public wrappedContent: Observable<ContentWrapperWithError>;
  public directoryContent: Observable<DirectoryContent>;
  public routes: Observable<NavigatorPath[]>;
  public showFilters = false;
  private readonly RootFolderName: string;
  private parentPath: string = null;

  private lastScroll = {
    any: 0,
    up: 0,
    down: 0
  };
  @ViewChild('dropdown', {static: true}) dropdown: BsDropdownDirective;
  @ViewChild('navigator', {read: ElementRef}) navigatorElement: ElementRef<HTMLInputElement>;

  constructor(
    public authService: AuthenticationService,
    public queryService: QueryService,
    public galleryService: ContentService,
    public filterService: FilterService,
    public sortingService: GallerySortingService,
    private router: Router,
    public sanitizer: DomSanitizer
  ) {
    this.sortingMethodsType = Utils.enumToArray(SortingMethods);
    this.RootFolderName = $localize`Home`;
    this.wrappedContent = this.galleryService.content;
    this.directoryContent = this.wrappedContent.pipe(
      map((c) => (c.directory ? c.directory : c.searchResult))
    );
    this.routes = this.galleryService.content.pipe(
      map((c) => {
        this.parentPath = null;
        if (!c.directory) {
          return [];
        }

        const path = c.directory.path.replace(new RegExp('\\\\', 'g'), '/');

        const dirs = path.split('/');
        dirs.push(c.directory.name);

        // removing empty strings
        for (let i = 0; i < dirs.length; i++) {
          if (!dirs[i] || 0 === dirs[i].length || '.' === dirs[i]) {
            dirs.splice(i, 1);
            i--;
          }
        }

        const user = this.authService.user.value;
        const arr: NavigatorPath[] = [];

        // create root link
        if (dirs.length === 0) {
          arr.push({name: this.RootFolderName, route: null});
        } else {
          arr.push({
            name: this.RootFolderName,
            route: UserDTOUtils.isDirectoryPathAvailable('/', user.permissions)
              ? '/'
              : null,
          });
        }

        // create rest navigation
        dirs.forEach((name, index) => {
          const route = dirs.slice(0, index + 1).join('/');
          if (dirs.length - 1 === index) {
            arr.push({name, route: null});
          } else {
            arr.push({
              name,
              route: UserDTOUtils.isDirectoryPathAvailable(route, user.permissions)
                ? route
                : null,
            });

          }
        });

        // parent directory has a shortcut to navigate to
        if (arr.length >= 2 && arr[arr.length - 2].route) {
          this.parentPath = arr[arr.length - 2].route;
          arr[arr.length - 2].title = $localize`key: alt + up`;
        }
        return arr;

      })
    );
  }

  get isDirectory(): boolean {
    return !!this.galleryService.content.value.directory;
  }

  get isSearch(): boolean {
    return !!this.galleryService.content.value.searchResult;
  }

  get ItemCount(): number {
    const c = this.galleryService.content.value;
    return c.directory
      ? c.directory.mediaCount
      : c.searchResult
        ? c.searchResult.media.length
        : 0;
  }

  get DefaultSorting(): SortingMethods {
    return this.sortingService.getDefaultSorting(
      this.galleryService.content.value
    );
  }

  setSorting(sorting: SortingMethods): void {
    this.sortingService.setSorting(sorting);
  }

  getDownloadZipLink(): string {
    const c = this.galleryService.content.value;
    if (!c.directory) {
      return null;
    }
    let queryParams = '';
    Object.entries(this.queryService.getParams()).forEach((e) => {
      queryParams += e[0] + '=' + e[1];
    });
    return Utils.concatUrls(
      Config.Server.urlBase,
      Config.Server.apiPath,
      '/gallery/zip/',
      c.directory.path,
      c.directory.name,
      '?' + queryParams
    );
  }

  getDirectoryFlattenSearchQuery(): string {
    const c = this.galleryService.content.value;
    if (!c.directory) {
      return null;
    }
    return JSON.stringify({
      type: SearchQueryTypes.directory,
      matchType: TextSearchQueryMatchTypes.like,
      text: Utils.concatUrls('./', c.directory.path, c.directory.name),
    } as TextSearch);
  }


  navigateToParentDirectory() {
    if (!this.parentPath) {
      return;
    }
    this.router.navigate(['/gallery', this.parentPath],
      {queryParams: this.queryService.getParams()})
      .catch(console.error);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyPress(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        if (event.altKey) {
          this.navigateToParentDirectory();
        }
        break;
    }
  }


  @HostListener('window:scroll')
  onScroll(): void {
    const scrollPosition = PageHelper.ScrollY;
    if (this.lastScroll.any < scrollPosition) { // scroll down
      //hide delay
      if (this.lastScroll.up < scrollPosition - window.innerHeight * Config.Gallery.NavBar.NavbarHideDelay) {
        this.showFilters = false;
        this.dropdown.hide();
      }
      this.lastScroll.down = scrollPosition;
    } else if (this.lastScroll.any > scrollPosition) {
      this.lastScroll.up = scrollPosition;
    }
    this.lastScroll.any = scrollPosition;
  }

  replaceUnderscore(text: string): string {
    return text?.replaceAll('_', ' ').trim() ?? ''
  }
}

interface NavigatorPath {
  name: string;
  route: string;
  title?: string;
}

