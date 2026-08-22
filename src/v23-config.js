export const CALIBRATION = {
  head:{start:.615,end:.695,pivotY:.675},
  faceFront:{start:.40,end:.61},
  eyeL:{cx:.379,cy:.782,rx:.092,ry:.042},
  eyeR:{cx:.623,cy:.782,rx:.092,ry:.042},
  mouth:{cx:.501,cy:.709,rx:.092,ry:.050},
  browL:{cx:.379,cy:.842,rx:.105,ry:.030},
  browR:{cx:.623,cy:.842,rx:.105,ry:.030},
  hair:{y0:.700,y1:.975,inner:.245,outer:.410},
  arms:{y0:.275,y1:.690,inner:.315,outer:.455}
};

export const EMOTIONS = {
  neutral:{ko:'기본',head:0,body:0,armL:0,armR:0,energy:.08,eyeL:1,eyeR:1,mouth:0,smile:.04,browL:0,browR:0},
  happy:{ko:'행복',head:-2.2,body:.6,armL:-1.6,armR:1.6,energy:.34,eyeL:.76,eyeR:.76,mouth:.14,smile:.92,browL:.10,browR:.10},
  excited:{ko:'신남',head:1.2,body:-.4,armL:-5.0,armR:5.0,energy:.90,eyeL:1.07,eyeR:1.07,mouth:.38,smile:.60,browL:.38,browR:.38},
  teasing:{ko:'장난',head:-5.2,body:-.8,armL:-3.8,armR:.8,energy:.50,eyeL:1,eyeR:.18,mouth:.10,smile:.76,browL:.25,browR:-.18},
  pleading:{ko:'울망',head:3.8,body:.5,armL:1.6,armR:-1.6,energy:.12,eyeL:1.06,eyeR:1.06,mouth:.05,smile:-.22,browL:.50,browR:.50},
  relaxed:{ko:'느긋',head:-3.0,body:.8,armL:.7,armR:-.7,energy:.06,eyeL:.70,eyeR:.70,mouth:.02,smile:.28,browL:-.08,browR:-.08},
  sick:{ko:'아픔',head:4.0,body:1.0,armL:.7,armR:-.7,energy:.03,eyeL:.60,eyeR:.60,mouth:.05,smile:-.35,browL:.30,browR:.30},
  angry:{ko:'화남',head:-1.2,body:-1.0,armL:2.0,armR:-2.0,energy:.62,eyeL:.76,eyeR:.76,mouth:.05,smile:-.88,browL:-.50,browR:-.50},
  annoyed:{ko:'삐짐',head:-4.2,body:.6,armL:1.0,armR:-1.0,energy:.10,eyeL:.78,eyeR:.66,mouth:.02,smile:-.62,browL:-.22,browR:.14},
  sad:{ko:'슬픔',head:4.4,body:.8,armL:1.2,armR:-1.2,energy:.04,eyeL:.88,eyeR:.88,mouth:.04,smile:-.72,browL:.48,browR:.48},
  surprised:{ko:'놀람',head:0,body:-.2,armL:-3.6,armR:3.6,energy:.74,eyeL:1.10,eyeR:1.10,mouth:.56,smile:0,browL:.58,browR:.58},
  embarrassed:{ko:'부끄러움',head:3.0,body:.5,armL:1.3,armR:-1.3,energy:.15,eyeL:.80,eyeR:.80,mouth:.07,smile:.40,browL:.20,browR:.20},
  scared:{ko:'겁남',head:1.8,body:.6,armL:1.8,armR:-1.8,energy:.58,eyeL:1.08,eyeR:1.08,mouth:.32,smile:-.52,browL:.56,browR:.56},
  smug:{ko:'의기양양',head:-3.8,body:-.6,armL:.8,armR:-.8,energy:.18,eyeL:.72,eyeR:.58,mouth:.03,smile:.70,browL:-.12,browR:.28},
  confused:{ko:'갸웃',head:5.5,body:0,armL:-.8,armR:.8,energy:.18,eyeL:.98,eyeR:.76,mouth:.04,smile:.06,browL:.44,browR:-.22},
  love:{ko:'좋아!',head:-2.0,body:.2,armL:1.4,armR:-1.4,energy:.52,eyeL:.68,eyeR:.68,mouth:.18,smile:.96,browL:.18,browR:.18}
};
