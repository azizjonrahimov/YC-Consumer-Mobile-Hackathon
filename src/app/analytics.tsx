import { useQuery } from 'convex/react';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../convex/_generated/api';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { Skeleton } from '../components/Skeleton';
import { StatNumber } from '../components/StatNumber';
import { blocks, formatDistance, timeAgo } from '../lib/format';
import { usePlayer } from '../lib/player';
import { myRank } from '../lib/rank';
import { useSettings } from '../lib/settings';
import { color, font, size, space, type } from '../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABEL_H = 18;
const BAR_GAP = 8;

type Walk = { createdAt: number; lengthM: number; cellCount: number; status: string };

/** Metres walked per day for the last 7 days, oldest first, built on the client from `recent`. */
function lastSevenDays(recent: Walk[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { start: d.getTime(), label: DAYS[d.getDay()], metres: 0 };
  });
  for (const w of recent) {
    const idx = days.findIndex((d, i) => w.createdAt >= d.start && (i === 6 || w.createdAt < days[i + 1].start));
    if (idx >= 0) days[idx].metres += w.lengthM;
  }
  return days;
}

const VALUE_H = 16; // room above the tallest bar for its value

function WeekChart({ recent }: { recent: Walk[] }) {
  const [w, setW] = useState(0);
  const days = useMemo(() => lastSevenDays(recent), [recent]);
  const max = Math.max(1, ...days.map((d) => d.metres));
  const total = days.reduce((s, d) => s + d.metres, 0);
  const h = size.chart;
  const barW = w > 0 ? (w - BAR_GAP * 6) / 7 : 0;

  return (
    <>
      <Text style={[type.bodyStrong, styles.text]}>
        {`${formatDistance(total)} this week · ${formatDistance(total / 7)} a day`}
      </Text>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: h + LABEL_H }}>
        {w > 0 && (
          <Svg width={w} height={h + LABEL_H} accessibilityLabel="Distance walked per day, last 7 days">
            {days.map((d, i) => {
              const bh = d.metres > 0 ? Math.max(4, (d.metres / max) * (h - VALUE_H)) : 2;
              const x = i * (barW + BAR_GAP);
              return (
                <Rect
                  key={d.start}
                  x={x}
                  y={h - bh}
                  width={barW}
                  height={bh}
                  rx={4}
                  fill={i === 6 ? color.accent : d.metres > 0 ? color.accentDim : color.border}
                />
              );
            })}
            {days.map((d, i) => {
              const bh = d.metres > 0 ? Math.max(4, (d.metres / max) * (h - VALUE_H)) : 2;
              return (
                <SvgText
                  key={`v-${d.start}`}
                  x={i * (barW + BAR_GAP) + barW / 2}
                  y={h - bh - 4}
                  fontSize={type.overline.fontSize}
                  fontFamily={font.bodySemi}
                  fill={d.metres > 0 ? color.text : color.textFaint}
                  textAnchor="middle">
                  {d.metres > 0 ? formatDistance(d.metres) : '0'}
                </SvgText>
              );
            })}
            {days.map((d, i) => (
              <SvgText
                key={`l-${d.start}`}
                x={i * (barW + BAR_GAP) + barW / 2}
                y={h + LABEL_H - 4}
                fontSize={type.caption.fontSize}
                fontFamily={font.bodyMedium}
                fill={i === 6 ? color.text : color.textMuted}
                textAnchor="middle">
                {d.label.charAt(0)}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
    </>
  );
}

/** Points a walk earned, per contract v4: floor(m / 10) + 10 per block; 0 when it did not count. */
const walkPoints = (w: Walk) => (w.status === 'captured' ? Math.floor(w.lengthM / 10) + 10 * w.cellCount : 0);

const STATUS: Record<string, string> = { captured: 'Captured', rejected: 'Did not count' };
const KCAL_PER_M = 0.05;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Extra numbers from the walks we already have (stats.recent is the newest 30 walks). */
function extraStats(recent: Walk[], totalM: number) {
  const captured = recent.filter((w) => w.status === 'captured');
  const longest = captured.reduce((m, w) => Math.max(m, w.cellCount), 0);
  const blocksClaimed = captured.reduce((s, w) => s + w.cellCount, 0);
  const perDay = new Map<number, number>();
  for (const w of recent) perDay.set(dayStart(w.createdAt), (perDay.get(dayStart(w.createdAt)) ?? 0) + w.lengthM);
  const bestDay = Math.max(0, ...perDay.values());
  // Streak: days in a row with a walk, ending today (or yesterday if not walked yet today).
  let day = dayStart(Date.now());
  if (!perDay.has(day)) day -= DAY_MS;
  let streak = 0;
  while (perDay.has(day)) {
    streak++;
    day = dayStart(day - DAY_MS / 2);
  }
  return { longest, blocksClaimed, bestDay, streak, kcal: Math.round(totalM * KCAL_PER_M) };
}

export default function Analytics() {
  useSettings();
  const insets = useSafeAreaInsets();
  const { player } = usePlayer();
  const stats = useQuery(api.stats.mine, player ? { playerId: player.playerId } : 'skip');
  const byPoints = useQuery(api.leaderboard.points);
  const byBlocks = useQuery(api.leaderboard.top);
  const pointsRank = myRank(byPoints, (r) => r.points, player?.playerId);
  const blocksRank = myRank(byBlocks, (r) => r.blocks, player?.playerId);
  const rankText = (r: number | null | undefined, of: number | undefined) =>
    r === undefined ? '…' : r === null ? `#– of ${of ?? 0}` : `#${r} of ${of ?? 0}`;

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Analytics" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {stats === undefined ? (
          <>
            <Skeleton height={160} />
            <Skeleton height={180} />
          </>
        ) : (
          <>
            <View style={styles.grid}>
              <Card style={styles.tile}>
                <StatNumber value={stats.points.toLocaleString('en-US')} label="Points" valueColor={color.accent} />
              </Card>
              <Card style={styles.tile}>
                <StatNumber value={stats.blocksHeld} label="Blocks held" />
              </Card>
              <Card style={styles.tile}>
                <StatNumber value={stats.walks} label="Walks" />
              </Card>
              <Card style={styles.tile}>
                <StatNumber value={formatDistance(stats.totalM)} label="Distance" />
              </Card>
              <Card style={styles.tile}>
                <StatNumber value={rankText(pointsRank, byPoints?.length)} label="Rank by points" valueColor={color.accent} />
              </Card>
              <Card style={styles.tile}>
                <StatNumber value={rankText(blocksRank, byBlocks?.length)} label="Rank by blocks" />
              </Card>
              {(() => {
                const x = extraStats(stats.recent, stats.totalM);
                return (
                  <>
                    <Card style={styles.tile}>
                      <StatNumber value={x.streak} label={x.streak === 1 ? 'Day streak' : 'Days in a row'} valueColor={color.accent} />
                    </Card>
                    <Card style={styles.tile}>
                      <StatNumber value={x.longest} label="Longest loop, blocks" />
                    </Card>
                    <Card style={styles.tile}>
                      <StatNumber value={formatDistance(x.bestDay)} label="Best day" />
                    </Card>
                    <Card style={styles.tile}>
                      <StatNumber value={x.blocksClaimed} label="Blocks claimed" />
                    </Card>
                    <Card style={styles.tile}>
                      <StatNumber value={`~${x.kcal.toLocaleString('en-US')}`} label="About kcal burned" />
                    </Card>
                  </>
                );
              })()}
            </View>

            <Card style={styles.section}>
              <Text style={[type.overline, styles.muted]}>Distance walked, last 7 days</Text>
              <WeekChart recent={stats.recent} />
            </Card>

            <Card style={styles.section}>
              <Text style={[type.overline, styles.muted]}>Steals</Text>
              <View style={styles.row}>
                <StatNumber value={stats.stealsMade} label="Made" valueColor={color.accent} style={styles.grow} />
                <StatNumber value={stats.stealsSuffered} label="Suffered" valueColor={color.danger} style={styles.grow} />
                {(() => {
                  const net = stats.stealsMade - stats.stealsSuffered;
                  return (
                    <StatNumber
                      value={net > 0 ? `+${net}` : `${net}`}
                      label="Net"
                      valueColor={net > 0 ? color.success : net < 0 ? color.danger : color.text}
                      style={styles.grow}
                    />
                  );
                })()}
              </View>
            </Card>

            <Text style={[type.overline, styles.muted]}>Last walks</Text>
            {stats.recent.length === 0 ? (
              <Card style={styles.section}>
                <Text style={[type.bodyStrong, styles.text, styles.tabular]}>{`0 walks · ${formatDistance(0)} · 0 blocks`}</Text>
                <Text style={[type.caption, styles.faint]}>Your walks will show up here.</Text>
              </Card>
            ) : (
              <Card style={styles.section}>
                {stats.recent.map((w, i) => (
                  <View key={`${w.createdAt}-${i}`} style={styles.row}>
                    <View style={styles.grow}>
                      <Text style={[type.callout, styles.text, styles.tabular]}>
                        {`${formatDistance(w.lengthM)} · ${blocks(w.status === 'captured' ? w.cellCount : 0)} · +${walkPoints(w)} pts`}
                      </Text>
                      <Text style={[type.caption, styles.faint]}>{timeAgo(w.createdAt)}</Text>
                    </View>
                    <Text style={[type.caption, w.status === 'captured' ? styles.success : styles.muted]}>
                      {STATUS[w.status] ?? w.status}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.lg, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexBasis: '47%', flexGrow: 1 },
  section: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  text: { color: color.text },
  muted: { color: color.textMuted },
  faint: { color: color.textFaint },
  success: { color: color.success },
  tabular: { fontVariant: ['tabular-nums'] },
});
