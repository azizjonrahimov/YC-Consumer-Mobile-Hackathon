import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { color, radius, size, space, type } from '../theme';

type Props = { lat: number; lng: number; name: string; mine: boolean; onPress?: () => void };

/** How long a custom marker keeps redrawing after mount or a change, so the SVG icon is in the snapshot. */
const REDRAW_MS = 500;
const LABEL_W = 120; // small, so nearby shops (Happy Cow and Neighbor Bakehouse are ~118 m apart) overlap less
const GLYPH_SIZE = 18;
const GAP = space.xs;
/** Anchor so the circle's centre (not the label) sits on the shop's coordinate. */
const ANCHOR_Y = size.shopPin / 2 / (size.shopPin + GAP + size.pill);
const PIN_Z = 10;

/** "Happy Cow Creamery & Tea" -> "Happy Cow"; otherwise the first two words. */
export function shortShopName(name: string): string {
  const beforeAmp = name.split(' & ')[0].trim();
  const words = beforeAmp.split(/\s+/);
  return words.length > 2 ? words.slice(0, 2).join(' ') : beforeAmp;
}

/**
 * Shop marker: 36 px circle with a gold border (lime when I hold it), a shop glyph, and the short
 * name in a pill underneath. Fixed width so iOS/Android do not clip the label.
 */
export function ShopPin({ lat, lng, name, mine, onPress }: Props) {
  // react-native-maps snapshots custom marker views; keep redrawing briefly after mount/changes,
  // then stop so the map does not re-render the marker every frame (blank icon / flicker fix).
  const [redraw, setRedraw] = useState(true);
  useEffect(() => {
    setRedraw(true);
    const t = setTimeout(() => setRedraw(false), REDRAW_MS);
    return () => clearTimeout(t);
  }, [mine, name]);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={{ x: 0.5, y: ANCHOR_Y }}
      tracksViewChanges={redraw}
      zIndex={PIN_Z}
      onPress={onPress}>
      <View style={styles.wrap} collapsable={false}>
        <View style={[styles.circle, { borderColor: mine ? color.accent : color.reward }]}>
          {/* A text glyph, not an SVG: SVG inside a react-native-maps Marker can snapshot blank on iOS. */}
          <Text style={styles.glyph} allowFontScaling={false}>
            {'\u{1F3EA}'}
          </Text>
        </View>
        <View style={[styles.label, mine && styles.labelMine]}>
          <Text style={[type.caption, styles.labelText]} numberOfLines={1} ellipsizeMode="tail">
            {shortShopName(name)}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { width: LABEL_W, alignItems: 'center', gap: GAP },
  circle: {
    width: size.shopPin,
    height: size.shopPin,
    borderRadius: radius.pill,
    borderWidth: size.hairline * 2,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    height: size.pill,
    maxWidth: LABEL_W,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.reward,
    backgroundColor: color.bg,
    justifyContent: 'center',
  },
  labelMine: { borderColor: color.accent },
  labelText: { color: color.text, textAlign: 'center' },
  glyph: { fontSize: GLYPH_SIZE, lineHeight: GLYPH_SIZE + space.xs, textAlign: 'center' },
});
