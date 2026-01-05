import { Component, Output, EventEmitter, Input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GarmentItem {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  modelPath: string;
}

@Component({
  selector: 'app-gallery-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery-bar.html',
  styleUrls: ['./gallery-bar.css']
})
export class GalleryBarComponent implements AfterViewInit, OnDestroy {
  @Input() selectedCategory: string = 'all';
  @Output() itemSelected = new EventEmitter<GarmentItem>();
  @ViewChild('galleryScroll') galleryScroll!: ElementRef<HTMLDivElement>;

  selectedItemId: string | null = null;
  centerItemIndex: number = 0;
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;
  private scrollTimeout: any;

  items: GarmentItem[] = [
    {
      id: 'shirt_1',
      name: 'Camisa Puntos',
      category: 'camisas',
      thumbnail: '/assets/clothes_images/FEM/camisas/camisa-1.jpg',
      modelPath: '/models/shirt-dots.glb'
    },
    {
      id: 'shirt_2',
      name: 'Camisa Rayas',
      category: 'camisas',
      thumbnail: '/assets/clothes_images/FEM/camisas/camisa-2.jpg',
      modelPath: '/models/shirt-striped.glb'
    },
    {
      id: 'shirt_3',
      name: 'Camisa Azul',
      category: 'camisas',
      thumbnail: '/assets/clothes_images/FEM/camisas/camisa-3.jpg',
      modelPath: '/models/shirt-blue.glb'
    },
    {
      id: 'shirt_4',
      name: 'Camisa Blanca',
      category: 'camisas',
      thumbnail: '/assets/clothes_images/FEM/camisas/camisa-4.jpg',
      modelPath: '/models/shirt-white.glb'
    },
    {
      id: 'shirt_5',
      name: 'Camisa Rosa',
      category: 'camisas',
      thumbnail: '/assets/clothes_images/FEM/camisas/camisa-5.jpg',
      modelPath: '/models/shirt-pink.glb'
    },
    {
      id: 'jacket_navy',
      name: 'Chaqueta Azul Marino',
      category: 'chaquetas',
      thumbnail: '/assets/clothes_images/FEM/chaquetas/chaqueta-1.jpg',
      modelPath: '/models/jacket-navy.glb'
    },
    {
      id: 'jacket_brown',
      name: 'Chaqueta Marrón',
      category: 'chaquetas',
      thumbnail: '/assets/clothes_images/FEM/chaquetas/chaqueta-2.jpg',
      modelPath: '/models/jacket-brown.glb'
    },
    {
      id: 'jacket_leather',
      name: 'Chaqueta Cuero',
      category: 'chaquetas',
      thumbnail: '/assets/clothes_images/FEM/chaquetas/chaqueta-3.jpg',
      modelPath: '/models/jacket-leather.glb'
    }
  ];

  get filteredItems(): GarmentItem[] {
    if (this.selectedCategory === 'all') {
      return this.items;
    }
    return this.items.filter(item => item.category === this.selectedCategory);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.centerItemIndex = 0;
      this.scrollToCenter(0);
    }, 100);

    const scrollEl = this.galleryScroll.nativeElement;

    scrollEl.addEventListener('scroll', this.onScroll.bind(this));
    scrollEl.addEventListener('mousedown', this.onMouseDown.bind(this));
    scrollEl.addEventListener('mouseleave', this.onMouseUp.bind(this));
    scrollEl.addEventListener('mouseup', this.onMouseUp.bind(this));
    scrollEl.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  ngOnDestroy(): void {
    if (this.galleryScroll) {
      const scrollEl = this.galleryScroll.nativeElement;
      scrollEl.removeEventListener('scroll', this.onScroll.bind(this));
      scrollEl.removeEventListener('mousedown', this.onMouseDown.bind(this));
      scrollEl.removeEventListener('mouseleave', this.onMouseUp.bind(this));
      scrollEl.removeEventListener('mouseup', this.onMouseUp.bind(this));
      scrollEl.removeEventListener('mousemove', this.onMouseMove.bind(this));
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.startX = e.pageX - this.galleryScroll.nativeElement.offsetLeft;
    this.scrollLeft = this.galleryScroll.nativeElement.scrollLeft;
    this.galleryScroll.nativeElement.style.cursor = 'grabbing';
  }

  onMouseUp(): void {
    this.isDragging = false;
    this.galleryScroll.nativeElement.style.cursor = 'grab';
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
    const x = e.pageX - this.galleryScroll.nativeElement.offsetLeft;
    const walk = (x - this.startX) * 2;
    this.galleryScroll.nativeElement.scrollLeft = this.scrollLeft - walk;
  }

  onScroll(): void {
    const scrollContainer = this.galleryScroll.nativeElement;
    const containerCenter = scrollContainer.scrollLeft + scrollContainer.clientWidth / 2;
    const items = scrollContainer.querySelectorAll('.gallery-item');

    let closestIndex = 0;
    let minDistance = Infinity;

    items.forEach((item, index) => {
      const itemElement = item as HTMLElement;
      const itemCenter = itemElement.offsetLeft + itemElement.clientWidth / 2;
      const distance = Math.abs(containerCenter - itemCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== this.centerItemIndex) {
      this.centerItemIndex = closestIndex;
    }

    // Limpiar timeout anterior
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Después de 200ms sin scrollear, seleccionar el item central
    this.scrollTimeout = setTimeout(() => {
      const centeredItem = this.filteredItems[this.centerItemIndex];
      if (centeredItem) {
        this.selectedItemId = centeredItem.id;
        this.itemSelected.emit(centeredItem);
      }
    }, 200);
  }

  onItemClick(item: GarmentItem, event?: MouseEvent): void {
    if (this.isDragging) return;

    this.selectedItemId = item.id;

    const index = this.filteredItems.indexOf(item);
    if (index !== -1) {
      this.scrollToCenter(index);
    }

    this.itemSelected.emit(item);
  }

  scrollToCenter(index: number): void {
    setTimeout(() => {
      const scrollContainer = this.galleryScroll.nativeElement;
      const items = scrollContainer.querySelectorAll('.gallery-item');
      const targetItem = items[index] as HTMLElement;

      if (targetItem) {
        const containerCenter = scrollContainer.clientWidth / 2;
        const itemCenter = targetItem.offsetWidth / 2;
        const scrollPosition = targetItem.offsetLeft - containerCenter + itemCenter;

        scrollContainer.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 50);
  }

  getItemClass(index: number): string {
    const distance = Math.abs(index - this.centerItemIndex);

    if (distance === 0) {
      return 'center';
    } else if (distance === 1) {
      return 'side';
    } else {
      return 'far';
    }
  }

  isItemInCenter(index: number): boolean {
    return index === this.centerItemIndex;
  }
}
