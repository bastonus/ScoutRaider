import { IPathProviderModule, ParsedTrack, TrackWaypoint } from '../routing_types';

export const loaderGpxModule: IPathProviderModule = {
  id: 'loader_gpx',
  name: 'Chargeur GPX Universel',
  version: '2.0.0',
  supportedFormats: ['gpx', 'xml'],
  requiresAuth: false,

  async parseTrack(fileContent: string | ArrayBuffer, filename?: string): Promise<ParsedTrack[]> {
    const text = typeof fileContent === 'string'
      ? fileContent
      : new TextDecoder('utf-8').decode(fileContent);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'application/xml');

    const tracks: ParsedTrack[] = [];
    const trkNodes = xmlDoc.getElementsByTagName('trk');

    // Extract Waypoints
    const waypoints: TrackWaypoint[] = [];
    const wptNodes = xmlDoc.getElementsByTagName('wpt');
    for (let i = 0; i < wptNodes.length; i++) {
      const node = wptNodes[i];
      const lat = parseFloat(node.getAttribute('lat') || '0');
      const lon = parseFloat(node.getAttribute('lon') || '0');
      const name = node.getElementsByTagName('name')[0]?.textContent || `Balise ${i + 1}`;
      const desc = node.getElementsByTagName('desc')[0]?.textContent || '';
      const eleStr = node.getElementsByTagName('ele')[0]?.textContent;
      const ele = eleStr ? parseFloat(eleStr) : undefined;

      waypoints.push({ lat, lon, ele, name, desc });
    }

    // Process Track Segments
    for (let t = 0; t < (trkNodes.length || 1); t++) {
      const trk = trkNodes[t];
      const trackName = trk?.getElementsByTagName('name')[0]?.textContent || filename || `Trace ${t + 1}`;
      const trkpts = trk ? trk.getElementsByTagName('trkpt') : xmlDoc.getElementsByTagName('trkpt');

      const coords: [number, number, number?][] = [];
      let eleGain = 0;
      let eleLoss = 0;
      let prevEle: number | null = null;

      for (let i = 0; i < trkpts.length; i++) {
        const pt = trkpts[i];
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lon = parseFloat(pt.getAttribute('lon') || '0');
        const eleNode = pt.getElementsByTagName('ele')[0];
        const ele = eleNode ? parseFloat(eleNode.textContent || '0') : undefined;

        coords.push(ele !== undefined ? [lon, lat, ele] : [lon, lat]);

        if (ele !== undefined) {
          if (prevEle !== null) {
            const diff = ele - prevEle;
            if (diff > 0) eleGain += diff;
            else eleLoss += Math.abs(diff);
          }
          prevEle = ele;
        }
      }

      tracks.push({
        id: `gpx_track_${Date.now()}_${t}`,
        name: trackName,
        coordinates: coords,
        distanceMeters: 0, // calculate if needed
        elevationGainMeters: Math.round(eleGain),
        elevationLossMeters: Math.round(eleLoss),
        waypoints: waypoints
      });
    }

    return tracks;
  }
};

export default loaderGpxModule;
