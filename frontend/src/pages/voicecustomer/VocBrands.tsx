import React from "react";
import styles from "./VocPlaceholder.module.css";

const VocBrands: React.FC = () => {
  return (
    <section className={styles.section}>
      <h1 className={styles.title}>Brands</h1>
      <p className={styles.text}>Placeholder page for managing tracked brands.</p>
    </section>
  );
};

export default VocBrands;
