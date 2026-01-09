import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {GarmentCategory} from "../../../domain/enums/garment-category.enum";
import {GarmentGender} from "../../../domain/enums/garment-gender.enum";

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-sidebar.html',
  styleUrls: ['./category-sidebar.css']
})
export class CategorySidebarComponent {
  @Output() categorySelected = new EventEmitter<GarmentCategory>();
  @Output() changeGender = new EventEmitter<void>();
  @Input() selectedCategory: GarmentCategory = GarmentCategory.UPPER_BODY;
  @Input() selectedGender: GarmentGender | null = null;
  @Input() pointingCategory: GarmentCategory | null = null;
  @Input() pointingGenderButton: boolean = false;
  @Input() pointingProgress: number = 0;

  protected readonly categories = Object.values(GarmentCategory);

  onCategoryClick(category: GarmentCategory): void {
    this.selectedCategory = category;
    this.categorySelected.emit(category);
  }

  onChangeGender(): void {
    this.changeGender.emit();
  }

  isPointing(category: GarmentCategory): boolean {
    return this.pointingCategory === category;
  }

  isSelected(category: GarmentCategory): boolean {
    return this.selectedCategory === category;
  }

  getGenderLabel(): string {
    if (!this.selectedGender) return '';

    switch (this.selectedGender) {
      case GarmentGender.MALE:
        return '👨 Masculino';
      case GarmentGender.FEMALE:
        return '👩 Femenino';
      case GarmentGender.UNISEX:
        return '👤 Unisex';
    }
  }
}
