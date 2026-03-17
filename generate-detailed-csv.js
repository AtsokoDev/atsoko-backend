const fs = require('fs');

try {
  // อ่านไฟล์ markdown
  const reportContent = fs.readFileSync('git-report.md', 'utf8');

  // Parse commits จาก markdown
  const commits = [];
  const commitPattern = /^### \d+\. Commit: ([a-f0-9]+)\n- \*\*Author:\*\* (.+?) \((.+?)\)\n- \*\*Date:\*\* (.+?)\n- \*\*Message:\*\* (.+)/gm;
  
  let match;
  while ((match = commitPattern.exec(reportContent)) !== null) {
    commits.push({
      hash: match[1],
      author: match[2],
      email: match[3],
      dateTime: match[4],
      message: match[5]
    });
  }

  // Group commits by date
  const dailyGroups = {};
  commits.forEach(commit => {
    const datePart = commit.dateTime.split(' ').slice(0, 1).join('');
    const timePart = commit.dateTime.split(' ').slice(1, 2).join('');
    
    if (!dailyGroups[datePart]) {
      dailyGroups[datePart] = [];
    }
    
    dailyGroups[datePart].push({
      time: timePart,
      message: commit.message,
      author: commit.author,
      hash: commit.hash.substring(0, 8),
      fullHash: commit.hash
    });
  });

  // Sort dates
  const sortedDates = Object.keys(dailyGroups).sort().reverse();

  // สร้าง CSV ที่แสดง commit แต่ละอันในแถวต่างๆ
  let csvContent = 'Date,Time,Commit Hash,Author,Commit Message\n';

  sortedDates.forEach(date => {
    const dayCommits = dailyGroups[date];
    dayCommits.forEach(commit => {
      const escapedMessage = commit.message.replace(/"/g, '""');
      csvContent += `"${date}","${commit.time}","${commit.hash}","${commit.author}","${escapedMessage}"\n`;
    });
  });

  // เขียนไฟล์
  fs.writeFileSync('git-detailed-commits.csv', csvContent);
  
  console.log('✅ Detailed Commits CSV Generated: git-detailed-commits.csv');
  console.log(`   • Total records: ${commits.length}`);
  
} catch (error) {
  console.error('Error:', error.message);
}
