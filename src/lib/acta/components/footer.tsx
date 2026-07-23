import { Text } from "@react-pdf/renderer";
import { styles } from "../styles";

export function Footer({ companyName, dateStr }: { companyName: string; dateStr: string }) {
  return (
    <Text style={styles.footer} fixed>
      {companyName} — Andes · {dateStr}
    </Text>
  );
}
