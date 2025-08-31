import React from "react";
import styles from "./VocPlaceholder.module.css";

const VocProducts: React.FC = () => {
  return (
    <section className={styles.section}>
      <h1 className={styles.title}>Products</h1>
      <p className={styles.text}>Placeholder page for managing tracked products.</p>
    </section>
  );
};

export default VocProducts;
