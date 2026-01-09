import { Component, Output, EventEmitter, Input, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Garment } from '../../../domain/model/garment';
import { GarmentCategory } from '../../../domain/enums/garment-category.enum';
import { GarmentGender } from '../../../domain/enums/garment-gender.enum';
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
  @Input() selectedGender: GarmentGender = GarmentGender.UNISEX;
  @Output() itemSelected = new EventEmitter<Garment | null>();
  @ViewChild('galleryScroll') galleryScroll!: ElementRef;

  selectedItemId: string | null = null;
  centerItemIndex: number = 0;
  isLoading = true;

  private categoryStates: Map<string, { index: number, itemId: string | null }> = new Map();
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;
  private scrollTimeout: any;

  constructor(private garmentCatalogService: GarmentCatalogService) {}

  async ngOnInit(): Promise<void> {
    await this.garmentCatalogService.initialize();
    this.isLoading = false;
  }

  get filteredItems(): (Garment | null)[] {
    const garments = this.garmentCatalogService.getGarmentsByCategoryAndGender(
        this.selectedCategory,
        this.selectedGender
    );
    return [null, ...garments];
  }

  private getStateKey(): string {
    return `${this.selectedCategory}_${this.selectedGender}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['selectedCategory'] && !changes['selectedCategory'].firstChange) ||
        (changes['selectedGender'] && !changes['selectedGender'].firstChange)) {

      const stateKey = this.getStateKey();
      const savedState = this.categoryStates.get(stateKey);

      if (savedState) {
        this.centerItemIndex = savedState.index;
        this.selectedItemId = savedState.itemId;

        setTimeout(() => {
          this.scrollToCenter(this.centerItemIndex);

          if (this.selectedItemId) {
            const item = this.filteredItems.find(g => g?.id === this.selectedItemId);
            if (item) {
              this.itemSelected.emit(item);
            }
          } else {
            this.itemSelected.emit(null);
          }
        }, 100);
      } else {
        this.centerItemIndex = 0;
        this.selectedItemId = null;

        setTimeout(() => {
          this.scrollToCenter(0);
        }, 100);
      }
    }
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
      const centeredItemId = centeredItem?.id || null;
      if (this.selectedItemId === centeredItemId) {
        return;
      }
    }, 200);
  }

  onItemClick(item: Garment | null, event?: MouseEvent): void {
    if (this.isDragging) return;

    this.selectedItemId = item?.id || null;
    const index = this.filteredItems.indexOf(item);
    if (index !== -1) {
      this.scrollToCenter(index);
      this.centerItemIndex = index;
    }

    const stateKey = this.getStateKey();
    this.categoryStates.set(stateKey, {
      index: this.centerItemIndex,
      itemId: this.selectedItemId
    });

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

      setTimeout(() => {
        const nextItem = this.filteredItems[this.centerItemIndex];
        this.selectedItemId = nextItem?.id || null;

        const stateKey = this.getStateKey();
        this.categoryStates.set(stateKey, {
          index: this.centerItemIndex,
          itemId: this.selectedItemId
        });

        this.itemSelected.emit(nextItem || null);
      }, 100);
    }
  }

  public navigatePrevious(): void {
    if (this.centerItemIndex > 0) {
      this.centerItemIndex--;
      this.scrollToCenter(this.centerItemIndex);

      setTimeout(() => {
        const prevItem = this.filteredItems[this.centerItemIndex];
        this.selectedItemId = prevItem?.id || null;

        const stateKey = this.getStateKey();
        this.categoryStates.set(stateKey, {
          index: this.centerItemIndex,
          itemId: this.selectedItemId
        });

        this.itemSelected.emit(prevItem || null);
      }, 100);
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

  isItemSelected(item: Garment | null): boolean {
    if (item === null) {
      return this.selectedItemId === null;
    }
    return this.selectedItemId === item.id;
  }
}
