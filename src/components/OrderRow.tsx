import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { formatRelative } from '@/domain/dates';
import { fullName, medLabel } from '@/domain/format';
import { getOrderStatus, STATUS_LABELS, STATUS_TONES } from '@/domain/orderStatus';
import type { Medication, Order, Resident } from '@/models';
import { colors, fontSize, spacing } from '@/theme';
import { Badge } from './Badge';
import { Card } from './Card';

interface OrderRowProps {
  order: Order;
  medication?: Medication;
  resident?: Resident;
  now: number;
  /** Hide the resident line when already on that resident's profile. */
  showResident?: boolean;
}

export function OrderRow({ order, medication, resident, now, showResident = true }: OrderRowProps) {
  const status = getOrderStatus(order, now);
  const medText = medication ? medLabel(medication) : 'Unknown medication';
  const residentText = resident ? `${fullName(resident)} · ${resident.room}` : 'Unknown resident';
  return (
    <Card
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      accessibilityLabel={`${medText} for ${residentText}, ${order.priority === 'stat' ? 'STAT, ' : ''}${STATUS_LABELS[status]}`}
      testID={`order-row-${order.id}`}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {medText}
        </Text>
        {order.priority === 'stat' && <Badge label="STAT" tone="danger" icon="flash" />}
      </View>
      {showResident && <Text style={styles.sub}>{residentText}</Text>}
      <View style={styles.bottom}>
        <Badge label={STATUS_LABELS[status]} tone={STATUS_TONES[status]} />
        <Text style={styles.time}>Submitted {formatRelative(order.submittedAt, now)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    marginTop: 2,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  bottom: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  time: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
