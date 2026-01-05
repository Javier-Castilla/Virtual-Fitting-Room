import { Component, Output, EventEmitter } from '@angular/core';
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

  selectedCategoryId: string = 'camisas';

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
}
