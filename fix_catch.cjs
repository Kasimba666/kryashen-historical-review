const fs = require('fs');
let lines = fs.readFileSync('src/services/ojs.js', 'utf8').split('\n');

// Find the fixed catch and add missing closing braces
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('} catch (e) {') && i > 0 && lines[i-1].includes('return json')) {
    // Check if the closing braces are missing
    // After "throw e" we should have "}", "})", "    })", "}"
    const afterThrow = i + 3; // line with "throw e" is i+2 (0-indexed)
    // Check what's after throw e
    if (lines[afterThrow] && lines[afterThrow].trim() === '})' && !lines[afterThrow].includes('        }')) {
      // Missing the closing } for catch block and }) for .then(text)
      // Insert "        }" before "    })"
      lines.splice(afterThrow, 0, '        }');
      // Now insert "      })" before "    })"
      lines.splice(afterThrow + 1, 0, '      })');
      console.log('Added missing closing braces');
      console.log('Lines after fix:');
      for (let j = i; j < i + 8; j++) {
        console.log('  ' + (j+1) + ': ' + JSON.stringify(lines[j]));
      }
      fs.writeFileSync('src/services/ojs.js', lines.join('\n'));
      console.log('FIXED!');
      break;
    }
  }
}
      if (lines[j].includes('return updatePublication(submissionId, publicationId, { issueId: issueId })')) {
        console.log('Removing stray line ' + (j+1) + ': ' + JSON.stringify(lines[j]));
        lines.splice(j, 1);
        break;
      }
    }
    
    fs.writeFileSync('src/services/ojs.js', lines.join('\n'));
    console.log('FIXED!');
    break;
  }
}
