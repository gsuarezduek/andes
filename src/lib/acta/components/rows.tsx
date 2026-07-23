import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaRow } from "../types";

export function Rows({ rows, grid }: { rows: ActaRow[]; grid?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <View style={grid ? styles.grid2 : undefined}>
      {rows.map((r, i) => (
        <View key={i} style={grid ? styles.cell : styles.row}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}
