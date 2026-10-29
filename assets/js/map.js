// Places the layers of the rain-areas map. Pure functions: no DOM, no network.
// The view is small (about 45 by 30 km), so longitude and latitude are treated as
// flat x and y. Positions are percentages of the view, for CSS left/top/width/height.

// A box { west, north, east, south } -> { left, top, width, height } in % of the view.
export function placeBox(box, view) {
  const spanX = view.east - view.west;
  const spanY = view.north - view.south;
  return {
    left: ((box.west - view.west) / spanX) * 100,
    top: ((view.north - box.north) / spanY) * 100,
    width: ((box.east - box.west) / spanX) * 100,
    height: ((box.north - box.south) / spanY) * 100,
  };
}

// A point (latitude, longitude) -> { left, top } in % of the view.
export function placePoint(latitude, longitude, view) {
  return {
    left: ((longitude - view.west) / (view.east - view.west)) * 100,
    top: ((view.north - latitude) / (view.north - view.south)) * 100,
  };
}
