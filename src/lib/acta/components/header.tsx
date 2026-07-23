import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function Header({ data, title }: { data: ActaData; title: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>{data.company.name}</Text>
        <Text style={styles.brandSub}>{data.company.address}</Text>
        <Text style={styles.brandSub}>
          {data.company.phone} · {data.company.web}
        </Text>
        <Text style={styles.brandSub}>
          {data.company.legalName} · CUIT {data.company.cuit}
        </Text>
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.brandSub, { textAlign: "right" }]}>{data.dateStr}</Text>
        {data.registeredBy ? (
          <Text style={[styles.brandSub, { textAlign: "right" }]}>
            {data.dict.acta.registeredBy}: {data.registeredBy}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
