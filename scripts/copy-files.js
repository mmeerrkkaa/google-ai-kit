const fs = require('fs-extra');
const path = require('path');

async function copyFiles() {
    try {
        
        if (await fs.pathExists(path.join(__dirname, '../dist/core'))) {
            await fs.copy(
                path.join(__dirname, '../dist/core'),
                path.join(__dirname, '../core'),
                { overwrite: true }
            );
            console.log('✓ Папка core скопирована');
        } else {
            console.log('⚠ Папка dist/core не найдена');
        }
                if (await fs.pathExists(path.join(__dirname, '../dist/types'))) {
            await fs.copy(
                path.join(__dirname, '../dist/types'),
                path.join(__dirname, '../types'),
                { overwrite: true }
            );
            console.log('✓ Папка types скопирована');
        } else {
            console.log('⚠ Папка dist/types не найдена');
        }
        
        console.log('Копирование завершено успешно!');
    } catch (error) {
        console.error('Ошибка при копировании файлов:', error);
        process.exit(1);
    }
}

copyFiles(); 