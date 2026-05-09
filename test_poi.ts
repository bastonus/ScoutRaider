import { POIService } from './src/logic/POIService';

const segments = [
    { coords: [[2.3522, 48.8566]], distance: 0 },
    { coords: [[2.3530, 48.8570]], distance: 0 }
];

console.log("Fetching POIs...");
POIService.fetchPOIsPerSegment(segments as any, undefined, undefined, 250).then(res => {
    console.log(JSON.stringify(res, null, 2));
}).catch(e => console.error(e));
