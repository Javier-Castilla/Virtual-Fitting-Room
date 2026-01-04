import { Garment } from './garment';
import { GarmentCategory } from '../enums/garment-category.enum';

export class Outfit {
    id: string;
    name: string;
    garments: Garment[] = [];

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    addGarment(garment: Garment): void {
        // Verificar si ya existe una prenda de la misma categoría
        const existingGarment = this.garments.find(
            g => g.category === garment.category
        );

        if (existingGarment) {
            throw new Error(
                `Ya existe una prenda de categoría ${garment.category}. ` +
                `Usa replaceGarment() para reemplazarla.`
            );
        }

        this.garments.push(garment);
    }

    removeGarment(garmentId: string): void {
        this.garments = this.garments.filter(g => g.id !== garmentId);
    }

    replaceGarment(garment: Garment): void {
        // Reemplazar prenda existente de la misma categoría
        const index = this.garments.findIndex(
            g => g.category === garment.category
        );

        if (index !== -1) {
            this.garments[index] = garment;
        } else {
            this.garments.push(garment);
        }
    }

    getGarment(id: string): Garment | undefined {
        return this.garments.find(g => g.id === id);
    }

    getGarmentByCategory(category: GarmentCategory): Garment | undefined {
        return this.garments.find(g => g.category === category);
    }

    hasCategory(category: GarmentCategory): boolean {
        return this.garments.some(g => g.category === category);
    }
}
