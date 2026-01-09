import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GarmentGender } from '../../../domain/enums/garment-gender.enum';

@Component({
  selector: 'app-gender-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gender-selector.html',
  styleUrls: ['./gender-selector.css']
})
export class GenderSelectorComponent {
  @Output() genderSelected = new EventEmitter<GarmentGender>();
  @Input() pointingGender: GarmentGender | null = null;
  @Input() pointingProgress: number = 0;

  readonly GarmentGender = GarmentGender;
  readonly genderOptions = [
    GarmentGender.MALE,
    GarmentGender.FEMALE,
    GarmentGender.UNISEX
  ];

  onSelectGender(gender: GarmentGender): void {
    this.genderSelected.emit(gender);
  }

  isPointing(gender: GarmentGender): boolean {
    return this.pointingGender === gender;
  }

  getGenderLabel(gender: GarmentGender): string {
    switch (gender) {
      case GarmentGender.MALE:
        return 'Masculino';
      case GarmentGender.FEMALE:
        return 'Femenino';
      case GarmentGender.UNISEX:
        return 'Unisex';
    }
  }

  getGenderIcon(gender: GarmentGender): string {
    switch (gender) {
      case GarmentGender.MALE:
        return '👨';
      case GarmentGender.FEMALE:
        return '👩';
      case GarmentGender.UNISEX:
        return '👤';
    }
  }
}
