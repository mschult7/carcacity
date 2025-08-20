export const playerColors = {};
 export const defaultColors = ['#3b9774', '#e67e22', '#8e44ad', '#f1c40f', '#3498db'];

 export function getColor(idx) {
    return defaultColors[idx % defaultColors.length];
 }