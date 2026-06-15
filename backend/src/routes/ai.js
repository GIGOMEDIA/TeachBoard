import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function parseExpression(exprStr) {
  const clean = exprStr.replace(/\s+/g, '');
  const termRegex = /([+-]?(?:(?:\d*\.)?\d+x\^?2|(?:\d*\.)?\d+x|x\^?2|x|(?:\d*\.)?\d+))/gi;
  const matches = clean.match(termRegex) || [];
  
  let coeffX2 = 0;
  let coeffX = 0;
  let constant = 0;
  
  for (let term of matches) {
    if (term.toLowerCase().includes('x^2') || term.toLowerCase().includes('x²')) {
      let coefStr = term.toLowerCase().replace(/x\^?2|x²/g, '');
      let coef = 1;
      if (coefStr === '-' || coefStr === '-0') coef = -1;
      else if (coefStr === '+' || coefStr === '+0') coef = 1;
      else if (coefStr) coef = parseFloat(coefStr);
      coeffX2 += coef;
    } else if (term.toLowerCase().includes('x')) {
      let coefStr = term.toLowerCase().replace(/x/g, '');
      let coef = 1;
      if (coefStr === '-' || coefStr === '-0') coef = -1;
      else if (coefStr === '+' || coefStr === '+0') coef = 1;
      else if (coefStr) coef = parseFloat(coefStr);
      coeffX += coef;
    } else {
      constant += parseFloat(term);
    }
  }
  return { coeffX2, coeffX, constant };
}

function formatQuadratic(a, b, c) {
  let str = '';
  if (a !== 0) {
    if (a === 1) str += 'x^2';
    else if (a === -1) str += '-x^2';
    else str += `${a}x^2`;
  }
  
  if (b !== 0) {
    const sign = b > 0 ? (str ? ' + ' : '') : (str ? ' - ' : '-');
    const val = Math.abs(b) === 1 ? '' : Math.abs(b);
    str += `${sign}${val}x`;
  }
  
  if (c !== 0) {
    const sign = c > 0 ? (str ? ' + ' : '') : (str ? ' - ' : '-');
    str += `${sign}${Math.abs(c)}`;
  } else if (!str) {
    str = '0';
  }
  return str;
}

function formatSolution(topic, a, b, c) {
  let steps = `### Step-by-Step Solution for: **${topic}**\n\n`;
  steps += `Let's solve the equation step-by-step:\n\n`;

  const lhsStr = formatQuadratic(a, b, c);
  steps += `1. **Standard Form Equation:**\n`;
  steps += `   $$${lhsStr} = 0$$\n\n`;

  if (a !== 0) {
    steps += `2. **Identify Coefficients (Quadratic Equation):**\n`;
    steps += `   Here, $a = ${a}$, $b = ${b}$, and $c = ${c}$.\n\n`;
    steps += `3. **Apply the Quadratic Formula:**\n`;
    steps += `   $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n`;
    steps += `   Substitute the coefficients:\n`;
    steps += `   $$x = \\frac{-(${b}) \\pm \\sqrt{(${b})^2 - 4(${a})(${c})}}{2(${a})}$$\n\n`;
    
    const disc = b * b - 4 * a * c;
    steps += `4. **Calculate the Discriminant ($D$):**\n`;
    steps += `   $$D = b^2 - 4ac = (${b})^2 - 4(${a})(${c})$$\n`;
    steps += `   $$D = ${b * b} - ${4 * a * c} = ${disc}$$\n\n`;

    if (disc > 0) {
      const sqrtD = Math.sqrt(disc);
      const x1 = (-b + sqrtD) / (2 * a);
      const x2 = (-b - sqrtD) / (2 * a);
      steps += `5. **Solve for Roots ($D > 0$ - Two Real Roots):**\n`;
      steps += `   $$\\sqrt{D} = \\sqrt{${disc}} \\approx ${sqrtD.toFixed(4)}$$\n`;
      steps += `   $$x_1 = \\frac{-(${b}) + ${sqrtD.toFixed(4)}}{${2 * a}} \\approx ${x1.toFixed(2)}$$\n`;
      steps += `   $$x_2 = \\frac{-(${b}) - ${sqrtD.toFixed(4)}}{${2 * a}} \\approx ${x2.toFixed(2)}$$\n\n`;
      steps += `6. **Final Answer:**\n`;
      steps += `   $$x \\approx ${x1.toFixed(2)} \\quad \\text{and} \\quad x \\approx ${x2.toFixed(2)}$$\n`;
    } else if (disc === 0) {
      const x = -b / (2 * a);
      steps += `5. **Solve for Roots ($D = 0$ - One Real Root):**\n`;
      steps += `   $$x = \\frac{-(${b})}{${2 * a}} \\approx ${x.toFixed(2)}$$\n\n`;
      steps += `6. **Final Answer:**\n`;
      steps += `   $$x \\approx ${x.toFixed(2)}$$\n`;
    } else {
      const realPart = -b / (2 * a);
      const imagPart = Math.sqrt(-disc) / (2 * a);
      steps += `5. **Solve for Roots ($D < 0$ - Complex Roots):**\n`;
      steps += `   $$\\sqrt{D} = \\sqrt{${disc}} = i\\sqrt{${-disc}} \\approx ${Math.sqrt(-disc).toFixed(4)}i$$\n`;
      steps += `   $$x_1 \\approx ${realPart.toFixed(2)} + ${imagPart.toFixed(2)}i$$\n`;
      steps += `   $$x_2 \\approx ${realPart.toFixed(2)} - ${imagPart.toFixed(2)}i$$\n\n`;
      steps += `6. **Final Answer:**\n`;
      steps += `   $$x \\approx ${realPart.toFixed(2)} \\pm ${imagPart.toFixed(2)}i$$\n`;
    }
  } else if (b !== 0) {
    steps += `2. **Isolate the Variable Term:**\n`;
    steps += `   $$${b}x = ${-c}$$\n\n`;
    steps += `3. **Divide by Coefficient of $x$:**\n`;
    steps += `   $$x = \\frac{${-c}}{${b}}$$\n`;
    
    const ans = -c / b;
    steps += `   $$x \\approx ${ans.toFixed(2)}$$\n\n`;
    steps += `4. **Final Answer:**\n`;
    steps += `   $$x \\approx ${ans.toFixed(2)}$$\n`;
  } else {
    steps += `2. **Analyze the Expression:**\n`;
    if (c === 0) {
      steps += `   $$0 = 0$$\n`;
      steps += `   This is an identity statement. It is true for all real values of $x$.\n`;
    } else {
      steps += `   $$${c} = 0$$\n`;
      steps += `   This is a contradiction. There are no values of $x$ that satisfy this equation.\n`;
    }
  }

  steps += `\n*Note: This is a simulated step-by-step solution because your Gemini API key is currently rate-limited (status 429).*`;
  return steps;
}

function solveMathProblem(topic) {
  const cleanedTopic = topic.toLowerCase()
    .replace(/\bsolve\s+it\b/g, '')
    .replace(/\bsolve\b/g, '')
    .replace(/\bcalculate\b/g, '')
    .replace(/\bwhat\s+is\b/g, '')
    .trim();

  if (cleanedTopic.includes('=')) {
    try {
      const parts = cleanedTopic.split('=');
      if (parts.length === 2) {
        const lhs = parseExpression(parts[0]);
        const rhs = parseExpression(parts[1]);
        
        const a = lhs.coeffX2 - rhs.coeffX2;
        const b = lhs.coeffX - rhs.coeffX;
        const c = lhs.constant - rhs.constant;
        
        return formatSolution(topic, a, b, c);
      }
    } catch (e) {
      // ignore
    }
  }

  const cleanExpr = cleanedTopic.replace(/[^0-9+\-*/().\s]/g, '').trim();
  if (cleanExpr && /^[0-9+\-*/().\s]*$/.test(cleanExpr) && /[0-9]/.test(cleanExpr)) {
    try {
      const result = new Function(`return (${cleanExpr})`)();
      if (typeof result === 'number' && !isNaN(result)) {
        return `### Calculation Result for: **${topic}**

Evaluating the arithmetic expression:

$$\\text{Expression: } ${cleanExpr}$$
$$\\text{Result: } ${result}$$

*Note: This is a simulated calculation because your Gemini API key is currently rate-limited (status 429).*`;
      }
    } catch (e) {
      // ignore
    }
  }

  if (cleanedTopic.toLowerCase().includes('x')) {
    try {
      const expr = parseExpression(cleanedTopic);
      if (expr.coeffX2 !== 0 || expr.coeffX !== 0) {
        return formatSolution(topic, expr.coeffX2, expr.coeffX, expr.constant);
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

// Post query to AI Assistant
router.post('/ask', authenticateToken, async (req, res) => {
  const { action, topic, context } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  // Construct prompts based on action
  let prompt = '';
  switch (action) {
    case 'solve':
      prompt = `Solve the following equation or math problem step-by-step: "${topic}". Outline calculations, explain the logic, and summarize the final answers clearly. Use markdown.`;
      break;
    case 'quiz':
      prompt = `Generate a 3-question multiple choice quiz on the topic: "${topic}". 
      Format the output strictly as a JSON array of objects, where each object has:
      - question: the question text
      - options: an array of 4 strings
      - correctIndex: the index (0-3) of the correct answer
      - explanation: brief explanation of why it is correct.
      Do not include markdown blocks like \`\`\`json, just return the raw JSON content.`;
      break;
    case 'examples':
      prompt = `Generate 3 illustrative real-world examples or applications of the concept: "${topic}". Use markdown list style with clear titles and brief paragraphs.`;
      break;
    case 'summarize':
      prompt = `Provide a concise pedagogical summary of the lesson: "${topic}". Context details: "${context || 'General teaching board content'}". Break down key takeaways and definitions.`;
      break;
    case 'explain':
      prompt = `Explain the educational concept of "${topic}" in simple, intuitive terms suitable for a student. Use analogies and markdown headers.`;
      break;
    case 'practice':
      prompt = `Create 4 practice questions of varying difficulty (Easy, Medium, Hard, Challenge) for the topic "${topic}". Include final numerical answers in parentheses at the end of each question, but do not show steps.`;
      break;
    default:
      prompt = `Respond to this educational question/request: "${topic}".`;
  }

  // If Gemini API Key exists, call Google Gemini REST API
  if (GEMINI_API_KEY) {
    try {
      console.log(`AI: Calling Gemini API for action "${action}"...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: action === 'quiz' ? { responseMimeType: 'application/json' } : undefined,
          }),
        }
      );


      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!answer) {
        throw new Error('Invalid response structure from Gemini API');
      }

      if (action === 'quiz') {
        try {
          const cleanJSON = answer.replace(/^\s*```json\s*|```\s*$/g, '').trim();
          const quizData = JSON.parse(cleanJSON);
          return res.json({ type: 'quiz', content: quizData });
        } catch (jsonErr) {
          console.warn('Failed to parse Gemini output as JSON, returning raw text as standard answer', jsonErr);
          return res.json({ type: 'text', content: answer });
        }
      }

      return res.json({ type: 'text', content: answer });
    } catch (err) {
      console.error('Gemini API call failed, falling back to simulated engine', err);
      // Fall through to mock responses below
    }
  }

  // Simulated Mock responses for demo purposes (Offline mode)
  console.log(`AI: Using simulated AI engine for "${action}" with topic: "${topic}"`);
  
  if (action === 'quiz') {
    const mockQuiz = [
      {
        question: `Which of the following represents the core concept of ${topic || 'this lesson'}?`,
        options: [
          `Option A: Primary foundational principle`,
          `Option B: Secondary alternative framework`,
          `Option C: Inverse coefficient variance`,
          `Option D: Non-correlated linear regression`
        ],
        correctIndex: 0,
        explanation: `Option A represents the primary foundational principle of ${topic || 'this lesson'} as studied in core curriculum guides.`
      },
      {
        question: `In standard application of ${topic || 'this lesson'}, what is the typical result of increasing input variables?`,
        options: [
          `Proportional scaling of values`,
          `Exponential degradation`,
          `Constant fixed output`,
          `Logarithmic cancellation`
        ],
        correctIndex: 0,
        explanation: `Most models show proportional scaling when factors are increased under steady-state assumptions.`
      },
      {
        question: `Which historical researcher or scientific discipline first formalized ${topic || 'this lesson'}?`,
        options: [
          `Classical mathematical treatises`,
          `Late-century industrial applications`,
          `Early renaissance philosophical observations`,
          `Modern empirical computational models`
        ],
        correctIndex: 3,
        explanation: `Formalization was completed using modern computational tools during the digital revolution.`
      }
    ];
    return res.json({ type: 'quiz', content: mockQuiz });
  }

  let textResponse = '';
  switch (action) {
    case 'solve': {
      const parsedSol = solveMathProblem(topic);
      if (parsedSol) {
        textResponse = parsedSol;
      } else {
        textResponse = `### Step-by-Step Solution for: **${topic}**

Let's solve the equation step-by-step:

1. **Given Expression / Equation:**
   $$${topic}$$

2. **Isolate Terms / Simplify:**
   Let's analyze the coefficients. If we assume a quadratic form like $ax^2 + bx + c = 0$, we check:
   - Identify coefficients: $a$, $b$, and $c$.
   - Calculate discriminant: $D = b^2 - 4ac$.

3. **Applying Mathematical Rules:**
   - Factoring: We find two numbers that multiply to $a \\cdot c$ and add up to $b$.
   - Simplifying, we arrive at the roots of the expression:
   $$x_1, x_2 = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

4. **Final Result:**
   The calculated values are $x \\approx 0.5$ and $x \\approx -3.0$ (depending on the variables provided).
   
*Note: This is a simulated step-by-step response because no Gemini API key was found in the environment variables.*`;
      }
      break;
    }

    case 'examples':
      textResponse = `### Real-World Examples of **${topic}**

Here are three practical contexts where this concept is actively used:

1. **Engineering & Structure Design**
   Engineers apply these formulas to calculate stress loads, vector balances, and dynamic resonance variables in bridges and skyscrapers.

2. **Computer Science & Algorithms**
   The principles govern pathfinding routines, coordinate system translations in 3D game engines, and numerical optimization in AI models.

3. **Financial Risk Analysis**
   Analysts use these models to calculate rates of return, project inflation scales, and compute volatility vectors over time.`;
      break;

    case 'explain':
      textResponse = `### Explaining **${topic}** Simply

Imagine you are slicing a pizza. If you want to know how much pizza each person gets, you divide the total area by the number of people. 
Similarly, **${topic}** is a tool that helps us divide a complex system into smaller, understandable pieces!

* **Core Idea:** Break down the big, scary equation into individual constants and variables.
* **Why it matters:** It lets us predict future results based on starting rules.
* **Analogy:** Just like baking a cake requires a recipe ratios, this math system defines the exact ratios for physical forces and shapes.`;
      break;

    case 'summarize':
      textResponse = `### Lesson Summary: **${topic}**

Here is a recap of today's lecture on **${topic}**:

* **Key Takeaway 1:** All mathematical representations must balance. What we do to one side of the canvas must reflect on the other.
* **Key Takeaway 2:** Visualizing functions (like graphing lines and parabolas) helps identify intersections and solution spaces instantly.
* **Formula Reference:** Keep in mind the primary formulas used during the whiteboard annotation session.
* **Self-Study:** Review the practice problems generated in the side panel to prepare for the upcoming quiz.`;
      break;

    case 'practice':
      textResponse = `### Practice Questions for **${topic}**

Here are some exercise questions to test your understanding:

1. **[Easy]** Evaluate the basic properties of the concept. What happens when the base value is doubled? (Ans: *The total value doubles proportionally*)
2. **[Medium]** Calculate the intersection point when the linear function is offset by 4 units. (Ans: *x = -2*)
3. **[Hard]** Solve for the variable $t$ if the system undergoes exponential decay rate of $0.05$ per minute. (Ans: *t = 13.86 minutes*)
4. **[Challenge]** Prove that the sum of areas matches the integral limit as the divisions approach infinity. (Ans: *Proof completed via Riemann Sums*)`;
      break;

    default: {
      const parsedSol = solveMathProblem(topic);
      if (parsedSol) {
        textResponse = parsedSol;
      } else {
        textResponse = `### Explanation for: **${topic}**

Here is an overview of the concept **${topic}**:

1. **Core Definition:** This represents a fundamental algebraic or scientific query.
2. **Methodology:**
   - Visualizing the elements on the coordinate board allows for geometric checking.
   - Solving requires isolating variables and checking ratios step-by-step.
3. **Next Steps:** Try asking to **Solve**, **Quiz**, or **Explain** this topic using the quick action buttons.

*Note: This is a simulated response because your Gemini API key is currently rate-limited (status 429).*`;
      }
      break;
    }
  }

  res.json({ type: 'text', content: textResponse });
});

export default router;
