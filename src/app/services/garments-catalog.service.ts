import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Garment } from '../../domain/model/garment';
import { GarmentCategory } from '../../domain/enums/garment-category.enum';
import { GarmentType } from '../../domain/enums/garment-type.enum';
import { GarmentGender } from '../../domain/enums/garment-gender.enum';

@Injectable({
    providedIn: 'root'
})
export class GarmentCatalogService {
    private garments: Garment[] = [];
    private initialized = false;

    constructor(private http: HttpClient) {}

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const modelsList = await firstValueFrom(
                this.http.get<Record<string, Record<string, Record<string, string[]>>>>('/assets/models-list.json')
            );

            this.garments = [];

            for (const [genderFolder, categoriesFolders] of Object.entries(modelsList)) {
                for (const [categoryFolder, typesFolders] of Object.entries(categoriesFolders)) {
                    for (const [typeFolder, modelNames] of Object.entries(typesFolders)) {
                        for (const modelName of modelNames) {
                            const newGarment = this.createGarment(genderFolder, categoryFolder, typeFolder, modelName);
                            const isDuplicate = this.garments.some(g => g.id === newGarment.id);
                            if (!isDuplicate) {
                                this.garments.push(newGarment);
                            }
                        }
                    }
                }
            }

            this.initialized = true;
        } catch (error) {
            throw error;
        }
    }

    private createGarment(genderFolder: string, categoryFolder: string, typeFolder: string, modelName: string): Garment {
        return new Garment(
            `${genderFolder}_${categoryFolder}_${typeFolder}_${modelName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            this.formatName(modelName),
            typeFolder as GarmentType,
            categoryFolder as GarmentCategory,
            `/assets/models/${genderFolder}/${categoryFolder}/${typeFolder}/${modelName}.glb`,
            `/assets/thumbnails/${genderFolder}/${categoryFolder}/${typeFolder}/${modelName}.png`,
            genderFolder as GarmentGender
        );
    }

    private formatName(modelName: string): string {
        return modelName
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    getAllGarments(): Garment[] {
        return [...this.garments];
    }

    getGarmentsByCategory(category: GarmentCategory, gender?: GarmentGender): Garment[] {
        let filtered = this.garments.filter(g => g.category === category);

        if (gender) {
            filtered = filtered.filter(g => g.gender === gender || g.gender === GarmentGender.UNISEX);
        }

        return filtered;
    }

    getGarmentsByCategoryAndGender(category: GarmentCategory, gender: GarmentGender): Garment[] {
        return this.garments.filter(g =>
            g.category === category && (g.gender === gender || g.gender === GarmentGender.UNISEX)
        );
    }

    getGarmentById(id: string): Garment | undefined {
        return this.garments.find(g => g.id === id);
    }

    getGarmentsByType(type: GarmentType): Garment[] {
        return this.garments.filter(g => g.type === type);
    }

    getGarmentsByGender(gender: GarmentGender): Garment[] {
        return this.garments.filter(g => g.gender === gender || g.gender === GarmentGender.UNISEX);
    }
}
