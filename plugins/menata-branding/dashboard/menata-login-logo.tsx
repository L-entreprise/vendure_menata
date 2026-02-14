export function MenataLoginLogo() {
    const logoUrl = new URL('../ui/logos/menata_deux_lignes.webp', import.meta.url).href;

    return (
        <div className="flex flex-col items-center gap-2">
            <img src={logoUrl} alt="Menata" className="h-20 w-auto object-contain" />
        </div>
    );
}
