import { Component, Output, EventEmitter, Input, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Garment } from '../../../domain/model/garment';
import { GarmentCategory } from '../../../domain/enums/garment-category.enum';
import { GarmentCatalogService} from "../../services/garments-catalog.service";

@Component({
  selector: 'app-gallery-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery-bar.html',
  styleUrls: ['./gallery-bar.css']
})
export class GalleryBarComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() selectedCategory: GarmentCategory = GarmentCategory.UPPER_BODY;
  @Output() itemSelected = new EventEmitter<Garment>();

  @ViewChild('galleryScroll') galleryScroll!: ElementRef;

  selectedItemId: string | null = null;
  centerItemIndex: number = 0;
  isLoading = true;

  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;
  private scrollTimeout: any;

  constructor(private garmentCatalogService: GarmentCatalogService) {}

  async ngOnInit(): Promise<void> {
    await this.garmentCatalogService.initialize();
    this.isLoading = false;
    console.log('✅ Gallery: Catálogo cargado');
  }

  get filteredItems(): Garment[] {
    return this.garmentCatalogService.getGarmentsByCategory(this.selectedCategory);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCategory'] && !changes['selectedCategory'].firstChange) {
      console.log('📂 Gallery: Categoría cambiada a:', this.selectedCategory);
      this.centerItemIndex = 0;
      setTimeout(() => {
        this.scrollToCenter(0);
        const firstItem = this.filteredItems[0];
        if (firstItem) {
          this.selectedItemId = firstItem.id;
          this.itemSelected.emit(firstItem);
        }
      }, 100);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.centerItemIndex = 0;
      this.scrollToCenter(0);
      const firstItem = this.filteredItems[0];
      if (firstItem) {
        this.selectedItemId = firstItem.id;
        this.itemSelected.emit(firstItem);
      }
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

    items.forEach((item: Element, index: number) => {
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

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      const centeredItem = this.filteredItems[this.centerItemIndex];
      if (centeredItem) {
        this.selectedItemId = centeredItem.id;
        this.itemSelected.emit(centeredItem);
      }
    }, 200);
  }

  onItemClick(item: Garment, event?: MouseEvent): void {
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

  public navigateNext(): void {
    const maxIndex = this.filteredItems.length - 1;
    if (this.centerItemIndex < maxIndex) {
      this.centerItemIndex++;
      this.scrollToCenter(this.centerItemIndex);
      console.log('➡️ Gallery: Navegando al siguiente item:', this.centerItemIndex);

      setTimeout(() => {
        const nextItem = this.filteredItems[this.centerItemIndex];
        if (nextItem) {
          this.selectedItemId = nextItem.id;
          this.itemSelected.emit(nextItem);
        }
      }, 100);
    } else {
      console.log('⚠️ Ya estás en el último item');
    }
  }

  public navigatePrevious(): void {
    if (this.centerItemIndex > 0) {
      this.centerItemIndex--;
      this.scrollToCenter(this.centerItemIndex);
      console.log('⬅️ Gallery: Navegando al item anterior:', this.centerItemIndex);

      setTimeout(() => {
        const prevItem = this.filteredItems[this.centerItemIndex];
        if (prevItem) {
          this.selectedItemId = prevItem.id;
          this.itemSelected.emit(prevItem);
        }
      }, 100);
    } else {
      console.log('⚠️ Ya estás en el primer item');
    }
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
