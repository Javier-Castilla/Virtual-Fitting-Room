import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SceneViewer } from './scene-viewer';

describe('SceneViewer', () => {
  let component: SceneViewer;
  let fixture: ComponentFixture<SceneViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneViewer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SceneViewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
