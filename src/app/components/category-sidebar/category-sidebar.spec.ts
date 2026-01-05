import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategorySidebar } from './category-sidebar';

describe('CategorySidebar', () => {
  let component: CategorySidebar;
  let fixture: ComponentFixture<CategorySidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorySidebar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategorySidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
