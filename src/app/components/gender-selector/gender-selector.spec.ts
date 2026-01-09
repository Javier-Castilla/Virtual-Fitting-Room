import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenderSelector } from './gender-selector';

describe('GenderSelector', () => {
  let component: GenderSelector;
  let fixture: ComponentFixture<GenderSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenderSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenderSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
