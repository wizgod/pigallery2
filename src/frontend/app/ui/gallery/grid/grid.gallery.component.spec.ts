import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ChangeDetectorRef} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

import {GalleryGridComponent} from './grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {ContentService} from '../content.service';
import {GallerySortingService} from '../navigator/sorting.service';
import {QueryService} from '../../../model/query.service';
import {of} from 'rxjs';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {GridMedia} from './GridMedia';

class MockQueryService {
}

class MockOverlayService {
}

class MockContentService {
}

class MockGallerySortingService {
}

describe('GalleryGridComponent', () => {
  let component: GalleryGridComponent;
  let fixture: ComponentFixture<GalleryGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [GalleryGridComponent],
      providers: [
        ChangeDetectorRef, Router,
        {provide: ContentService, useClass: MockContentService},
        {provide: QueryService, useClass: MockQueryService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: OverlayService, useClass: MockOverlayService},
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of([{id: 1}]),
            params: of([{id: 1}]),
          },
        }]
    })
        .compileComponents();

    fixture = TestBed.createComponent(GalleryGridComponent);
    component = fixture.componentInstance;
    component.lightbox = {
      setGridPhotoQL: () => {
        // mock
      }
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('should mergePhotos', () => {
    const phs: PhotoDTO[] = [];
    const gPhs: GridMedia[] = [];
    for (let i = 0; i < 10; ++i) {
      const p = {name: i + '.jpg', directory: {name: 'd' + i, path: 'p' + i}} as any;
      phs.push(p);
      gPhs.push(new GridMedia(p, 1, 1, i));
    }
    /*-----------------------*/
    component.mediaGroups = [{name: 'equal 1', media: [phs[0], phs[1]]}];
    component.mediaToRender = [{name: 'equal 1', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'equal 1', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'empty render', media: [phs[0], phs[1]]}];
    component.mediaToRender = [];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'no 2nd yet', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[3]]}];
    component.mediaToRender = [{name: 'no 2nd yet', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'no 2nd yet', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'eql 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[3]]}];
    component.mediaToRender = [{name: 'eql 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'eql 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    /*-----------------------*/
    component.mediaGroups = [];
    component.mediaToRender = [{name: 'empty', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'no overlap', media: [phs[2], phs[3]]}, {name: '1', media: [phs[0], phs[1]]}];
    component.mediaToRender = [{name: '1', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'removed 2nd 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2]]}];
    component.mediaToRender = [{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3], gPhs[4]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'removed 2nd 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[5]]}];
    component.mediaToRender = [{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[5], gPhs[3], gPhs[4]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'removed from 1st', media: [phs[0]]},{name: '2', media: [phs[2],phs[3],phs[4]]}];
    component.mediaToRender = [{name: 'removed from 1st', media: [gPhs[0], gPhs[1]]},{name: '2', media: [gPhs[2], gPhs[3], gPhs[4]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed from 1st', media: [gPhs[0]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'removed 2nd', media: [phs[0], phs[1]]},{name: '2', media: [phs[2]]}];
    component.mediaToRender = [{name: 'removed 2nd', media: [gPhs[0], gPhs[1]]},{name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed 2nd', media: [gPhs[0], gPhs[1]]},{name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'removed from 1st 2', media: [phs[0]]},{name: '2', media: [phs[2], phs[3]]}];
    component.mediaToRender = [{name: 'removed from 1st 2', media: [gPhs[0], gPhs[1]]},{name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed from 1st 2', media: [gPhs[0]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: 'merged', media: [phs[0], phs[1],phs[2],phs[3]]}];
    component.mediaToRender = [{name: 'merged dif name', media: [gPhs[0], gPhs[1]]},{name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'merged', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    component.mediaGroups = [{name: '3', media: [phs[0], phs[1],phs[2],phs[3]]}];
    component.mediaToRender = [{name: '1', media: [gPhs[0], gPhs[1],gPhs[3], gPhs[2]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: '3', media: [gPhs[0], gPhs[1]]}]);

  });
});
