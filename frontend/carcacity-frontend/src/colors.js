export const playerColors = {};
 export const defaultColors = ['#3b9774', '#ff9671', '#845ec2', '#FFDB58', '#3498db'];

 export function getColor(idx) {
    return defaultColors[idx % defaultColors.length];
 }