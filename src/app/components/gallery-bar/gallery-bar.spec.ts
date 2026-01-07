import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GalleryBar } from './gallery-bar';

describe('GalleryBar', () => {
  let component: GalleryBar;
  let fixture: ComponentFixture<GalleryBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GalleryBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
