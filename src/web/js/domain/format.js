const brazilian = value => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export const formatArea = area => (area === null ? "—" : `${brazilian(area)} m²`);
export const formatDiscount = discount => (discount === null ? "—" : `${brazilian(discount)}%`);
