import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Garment } from '../../domain/model/garment';
import { GarmentCategory } from '../../domain/enums/garment-category.enum';
import { GarmentType } from '../../domain/enums/garment-type.enum';

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
                this.http.get<Record<string, Record<string, string[]>>>('/assets/models-list.json')
            );

            for (const [categoryFolder, typesFolders] of Object.entries(modelsList)) {
                for (const [typeFolder, modelNames] of Object.entries(typesFolders)) {
                    for (const modelName of modelNames) {
                        this.garments.push(this.createGarment(categoryFolder, typeFolder, modelName));
                    }
                }
            }

            this.initialized = true;
            console.log(`✅ Catálogo cargado: ${this.garments.length} prendas`);
        } catch (error) {
            console.error('❌ Error cargando catálogo:', error);
            throw error;
        }
    }

    private createGarment(categoryFolder: string, typeFolder: string, modelName: string): Garment {
        return {
            id: `${categoryFolder}_${typeFolder}_${modelName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            name: this.formatName(modelName),
            category: categoryFolder as GarmentCategory,
            type: typeFolder as GarmentType,
            modelPath: `/assets/models/${categoryFolder}/${typeFolder}/${modelName}.glb`,
            imagePath: `/assets/thumbnails/${categoryFolder}/${typeFolder}/${modelName}.png`
        };
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

    getGarmentsByCategory(category: GarmentCategory): Garment[] {
        return this.garments.filter(g => g.category === category);
    }

    getGarmentById(id: string): Garment | undefined {
        return this.garments.find(g => g.id === id);
    }

    getGarmentsByType(type: GarmentType): Garment[] {
        return this.garments.filter(g => g.type === type);
    }
}
