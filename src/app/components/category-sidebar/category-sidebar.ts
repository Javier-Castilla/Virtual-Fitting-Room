import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {GarmentCategory} from "../../../domain/enums/garment-category.enum";

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-sidebar.html',
  styleUrls: ['./category-sidebar.css']
})
export class CategorySidebarComponent {
  @Output() categorySelected = new EventEmitter<GarmentCategory>();
  @Input() selectedCategory: GarmentCategory = GarmentCategory.UPPER_BODY;
  @Input() pointingCategory: GarmentCategory | null = null;
  @Input() pointingProgress: number = 0;

  protected readonly categories = Object.values(GarmentCategory);

  onCategoryClick(category: GarmentCategory): void {
    this.selectedCategory = category;
    this.categorySelected.emit(category);
  }

  isPointing(category: GarmentCategory): boolean {
    return this.pointingCategory === category;
  }

  isSelected(category: GarmentCategory): boolean {
    return this.selectedCategory === category;
  }
}