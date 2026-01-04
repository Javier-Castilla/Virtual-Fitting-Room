import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CameraFeed } from './camera-feed';

describe('CameraFeed', () => {
  let component: CameraFeed;
  let fixture: ComponentFixture<CameraFeed>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CameraFeed]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CameraFeed);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
