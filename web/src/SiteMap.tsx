import { useEffect } from 'react'
import type { LatLngBoundsExpression } from 'leaflet'
import { CircleMarker, LayersControl, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import SitePopup from './SitePopup'
import type { LocationFeature } from './types'

/** The initial view and the hard limit on panning. Covers mainland Alaska and
 *  the eastern Aleutians; the sites themselves run 53.9–64.8 N, 166.7–130.3 W. */
const ALASKA_BOUNDS: LatLngBoundsExpression = [
  [51, -172],
  [70, -128],
]

/** Low enough that the bounds above still fit inside a narrow column. Zooming
 *  out past this would put the whole world in view, which maxBounds cannot
 *  clamp — once the viewport is wider than the bounds there is nothing to
 *  push back against. */
const MIN_ZOOM = 3

/* The accent, as a literal — Leaflet paints the marker on a canvas rather than
   through CSS, so it can't read the sage-* utilities. Kept a light step (~sage-300)
   because the satellite basemap under it is itself dark green and brown. */
const SELECTED_STYLE = {
  color: '#ffffff',
  weight: 2,
  fillColor: '#b3cca6',
  fillOpacity: 0.95,
}

const UNSELECTED_STYLE = {
  color: '#ffffff',
  weight: 1.5,
  fillColor: '#0e7490',
  fillOpacity: 0.85,
}

type Props = {
  /** Sites with a non-null geometry only — anything else cannot be drawn. */
  features: LocationFeature[]
  selectedId: number | null
  onSelect: (locationId: number) => void
}

/** Pans to the selected site, leaving zoom alone so the statewide view is kept.
 *
 *  Lives inside MapContainer because useMap() reads Leaflet's React context.
 *  Takes lat/lon as separate numbers rather than a tuple: a fresh array every
 *  render would re-fire the effect and yank the map back mid-drag.
 */
function PanToSelected({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap()

  useEffect(() => {
    if (lat !== null && lon !== null) map.panTo([lat, lon])
  }, [map, lat, lon])

  return null
}

export default function SiteMap({ features, selectedId, onSelect }: Props) {
  const selected = features.find((f) => f.properties.location_id === selectedId)
  const [selLon, selLat] = selected?.geometry?.coordinates ?? [null, null]

  return (
    <MapContainer
      bounds={ALASKA_BOUNDS}
      maxBounds={ALASKA_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={MIN_ZOOM}
      scrollWheelZoom
      className="h-full w-full bg-stone-200 dark:bg-slate-900"
    >
      <LayersControl position="topright">
        {/* Esri's tile path is {z}/{y}/{x} — y and x are swapped relative to
            every other provider here. */}
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer
            attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxNativeZoom={17}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Streets">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Light">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <PanToSelected lat={selLat} lon={selLon} />

      {features.map((feature) => {
        const [lon, lat] = feature.geometry!.coordinates
        const { location_id, name } = feature.properties
        const isSelected = location_id === selectedId

        return (
          <CircleMarker
            key={location_id}
            center={[lat, lon]}
            radius={isSelected ? 9 : 6}
            pathOptions={isSelected ? SELECTED_STYLE : UNSELECTED_STYLE}
            eventHandlers={{ click: () => onSelect(location_id) }}
          >
            <Popup>
              <SitePopup locationId={location_id} name={name} />
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
