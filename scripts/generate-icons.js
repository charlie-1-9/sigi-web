// Regenera todos los íconos de la PWA (public/icons/icon-*.png) y el
// favicon.ico a partir del SVG maestro (public/icons/source-icon.svg).
//
// Uso: npm run icons:generate
//
// Solo hace falta correrlo si se cambia el diseño del ícono; los PNG/ICO
// generados ya quedan versionados en el repo, así que en el día a día no
// hace falta tener sharp/png-to-ico instalados para levantar el proyecto.

const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const ICONS_DIR = path.resolve(__dirname, '../public/icons');
const SOURCE_SVG = path.join(ICONS_DIR, 'source-icon.svg');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
	for (const size of SIZES) {
		const outFile = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

		await sharp(SOURCE_SVG, { density: 384 }).resize(size, size).png().toFile(outFile);

		console.log('✓', path.relative(process.cwd(), outFile));
	}

	// El favicon se arma a partir de una versión de 256×256 (png-to-ico
	// reduce internamente a 48/32/16 y agrega la capa de 256 tal cual).
	const tmpFile = path.join(require('node:os').tmpdir(), 'sigi-web-favicon-256.png');

	await sharp(SOURCE_SVG, { density: 384 }).resize(256, 256).png().toFile(tmpFile);

	const ico = await pngToIco(tmpFile);

	fs.writeFileSync(path.resolve(__dirname, '../public/favicon.ico'), ico);
	fs.unlinkSync(tmpFile);

	console.log('✓ public/favicon.ico');
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
