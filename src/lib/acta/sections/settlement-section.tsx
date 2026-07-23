import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { formatArs } from "@/lib/contract";
import type { ActaData } from "../types";

export function SettlementSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  if (!data.settlement) return null;
  const s = data.settlement;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.settlement.title}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>
          {t.settlement.extraKm}
          {s.extraKm > 0 ? ` (${s.extraKm.toLocaleString()} km)` : ""}
        </Text>
        <Text style={styles.value}>{formatArs(s.extraKmCharge)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>
          {t.settlement.fuel} ({s.fuelMissingEighths}/{data.fuelLevels})
        </Text>
        <Text style={styles.value}>{formatArs(s.fuelCharge)}</Text>
      </View>
      {s.damageCharges.map((d, i) => (
        <View style={styles.row} key={i}>
          <Text style={styles.label}>
            {t.settlement.damage}: {d.description}
          </Text>
          <Text style={styles.value}>{formatArs(d.amount)}</Text>
        </View>
      ))}
      <View style={[styles.row, { borderTop: "1px solid #e2e8f0", marginTop: 3, paddingTop: 3 }]}>
        <Text style={styles.label}>{t.settlement.subtotal}</Text>
        <Text style={styles.value}>{formatArs(s.subtotal)}</Text>
      </View>
      {s.depositApplied > 0 ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t.settlement.depositApplied}</Text>
          <Text style={styles.value}>{formatArs(s.depositApplied)}</Text>
        </View>
      ) : null}
      {s.balanceDue > 0 ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t.settlement.balanceDue}</Text>
          <Text style={styles.fail}>{formatArs(s.balanceDue)}</Text>
        </View>
      ) : null}
      {s.depositReturn > 0 ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t.settlement.depositReturn}</Text>
          <Text style={styles.value}>{formatArs(s.depositReturn)}</Text>
        </View>
      ) : null}
      {s.method !== "none" ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t.settlement.method}</Text>
          <Text style={styles.value}>{t.settlement.methods[s.method]}</Text>
        </View>
      ) : null}
      {s.note ? (
        <Text style={styles.small}>
          {t.settlement.note}: {s.note}
        </Text>
      ) : null}
    </View>
  );
}
