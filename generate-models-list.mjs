import { readdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateModelsList() {
    const modelsPath = join(__dirname, 'public', 'assets', 'models');
    const outputPath = join(__dirname, 'public', 'assets', 'models-list.json');

    const modelsByGender = {};

    try {
        const genders = await readdir(modelsPath, { withFileTypes: true });

        for (const genderDir of genders) {
            if (!genderDir.isDirectory()) continue;

            const genderName = genderDir.name;
            const genderPath = join(modelsPath, genderName);

            modelsByGender[genderName] = {};

            const categories = await readdir(genderPath, { withFileTypes: true });

            for (const categoryDir of categories) {
                if (!categoryDir.isDirectory()) continue;

                const categoryName = categoryDir.name;
                const categoryPath = join(genderPath, categoryName);

                modelsByGender[genderName][categoryName] = {};

                const types = await readdir(categoryPath, { withFileTypes: true });

                for (const typeDir of types) {
                    if (!typeDir.isDirectory()) continue;

                    const typeName = typeDir.name;
                    const typePath = join(categoryPath, typeName);

                    const files = await readdir(typePath);
                    const modelFiles = files
                        .filter(f => f.endsWith('.glb') || f.endsWith('.gltf'))
                        .map(f => f.replace(/\.(glb|gltf)$/i, ''));

                    if (modelFiles.length > 0) {
                        modelsByGender[genderName][categoryName][typeName] = modelFiles;
                        console.log(`📁 ${genderName}/${categoryName}/${typeName}: ${modelFiles.length} modelos`);
                    }
                }
            }
        }

        await writeFile(outputPath, JSON.stringify(modelsByGender, null, 2), 'utf-8');

        let total = 0;
        for (const categories of Object.values(modelsByGender)) {
            for (const types of Object.values(categories)) {
                for (const models of Object.values(types)) {
                    total += models.length;
                }
            }
        }

        console.log(`\n✅ Generado models-list.json: ${total} modelos`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

generateModelsList();
