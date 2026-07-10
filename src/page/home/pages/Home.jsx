import React, { useState } from 'react';
import styles from '../styles/App.module.css';
import Component from '../components/braille-editor';
import { FilePlus2, X, Sparkles } from 'lucide-react';

const Home = () => {
  const [isShow, setIsShow] = useState(true);

  return (
    <>
      {isShow && (
        <div className={styles.overlay}>
          <div className={styles.modal}>

            <div className={styles.iconBox}>
              <FilePlus2 size={45} />
              <Sparkles className={styles.sparkle} size={20} />
            </div>

            <h2>សូមស្វាគមន៍ 👋</h2>

            <p>
              មុននឹងធ្វើការសរសេរឯកសារណាមួយ
              សូមធ្វើការបង្កើត File ជាមុនសិន។
              បន្ទាប់មកអាច Open File ហើយចាប់ផ្ដើមសរសេរ
              រួចធ្វើការ Save បាន។
            </p>

            <button
              className={styles.closeBtn}
              onClick={() => setIsShow(false)}
            >
              <X size={18} />
              Close
            </button>

          </div>
        </div>
      )}

      <div
        className={styles.Home}
        style={{ fontFamily: 'khmer' }}
      >
        <Component />
      </div>
    </>
  );
};

export default Home;
