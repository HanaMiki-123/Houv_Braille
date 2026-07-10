import React from 'react';
import styles from '../styles/App.module.css';
import Component from '../components/braille-editor';

const Home = () => {
  return (
    <>
      <div className={styles.Home} style={{ fontFamily: 'khmer' }}>
        <Component />
      </div>
    </>
  );
};

export default Home;
