import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Category {
  id: string;
  label: string;
}

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-sidebar.html',
  styleUrls: ['./category-sidebar.css']
})
export class CategorySidebarComponent {
  @Output() categorySelected = new EventEmitter<string>();
  @Input() selectedCategoryId: string = 'camisas';
  @Input() pointingCategoryId: string | null = null;
  @Input() pointingProgress: number = 0; // 0-100

  categories: Category[] = [
    { id: 'chaquetas', label: 'Chaquetas' },
    { id: 'camisas', label: 'Camisas' },
    { id: 'pantalones', label: 'Pantalones y faldas' },
    { id: 'vestidos', label: 'Vestidos' }
  ];

  onCategoryClick(category: Category): void {
    this.selectedCategoryId = category.id;
    this.categorySelected.emit(category.id);
  }

  isPointing(categoryId: string): boolean {
    return this.pointingCategoryId === categoryId;
  }

  isSelected(categoryId: string): boolean {
    return this.selectedCategoryId === categoryId;
  }
}
