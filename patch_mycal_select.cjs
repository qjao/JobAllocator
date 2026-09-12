const fs = require('fs');
let code = fs.readFileSync('src/components/MyCalendar.tsx', 'utf8');

const target1 = `setEditingAllocation(null);
                  
                } catch (error) {`;
const replacement1 = `setEditingAllocation(null);
                  setSelectedAllocation(null);
                  
                } catch (error) {`;

const target2 = `onCancel={() => setEditingAllocation(null)}`;
const replacement2 = `onCancel={() => { setEditingAllocation(null); setSelectedAllocation(null); }}`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/MyCalendar.tsx', code);
