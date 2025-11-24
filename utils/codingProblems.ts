
import { CodingProblem } from '../types';

export const CODING_PROBLEMS: Record<string, CodingProblem> = {
  'two-sum': {
      id: 'two-sum',
      title: 'Two Sum',
      description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
You may assume that each input would have exactly one solution, and you may not use the same element twice.
You can return the answer in any order.

Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]

Example 2:
Input: nums = [3,2,4], target = 6
Output: [1,2]`,
      difficulty: 'Easy',
      timeLimit: 15,
      tags: ['Array', 'Hash Table'],
      expectedComplexity: 'O(n)',
      initialCode: {
          javascript: `function twoSum(nums, target) {
  // Write your solution here
}`,
          python: `def twoSum(nums, target):
    pass`
      },
      testCases: [
          { id: 't1', input: 'nums=[2,7,11,15], target=9', expectedOutput: '[0,1]', visible: true },
          { id: 't2', input: 'nums=[3,2,4], target=6', expectedOutput: '[1,2]', visible: true },
          { id: 't3', input: 'nums=[3,3], target=6', expectedOutput: '[0,1]', visible: false }
      ],
      hints: ["Try using a hash map to store numbers you've already seen."]
  },
  'merge-intervals': {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    description: `Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

Example 1:
Input: intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
Explanation: Since intervals [1,3] and [2,6] overlap, merge them into [1,6].

Example 2:
Input: intervals = [[1,4],[4,5]]
Output: [[1,5]]
Explanation: Intervals [1,4] and [4,5] are considered overlapping.

Constraints:
1 <= intervals.length <= 10^4
intervals[i].length == 2
0 <= start_i <= end_i <= 10^4`,
    difficulty: 'Medium',
    timeLimit: 20,
    tags: ['Array', 'Sorting'],
    expectedComplexity: 'O(n log n)',
    initialCode: {
      javascript: `function merge(intervals) {
  // Your code here
  
}`,
      python: `def merge(intervals):
    # Your code here
    pass`
    },
    testCases: [
      { id: 't1', input: '[[1,3],[2,6],[8,10],[15,18]]', expectedOutput: '[[1,6],[8,10],[15,18]]', visible: true },
      { id: 't2', input: '[[1,4],[4,5]]', expectedOutput: '[[1,5]]', visible: true },
      { id: 't3', input: '[[1,4],[0,4]]', expectedOutput: '[[0,4]]', visible: false }, // Hidden edge case
      { id: 't4', input: '[]', expectedOutput: '[]', visible: false } // Hidden empty
    ],
    hints: [
      "Sort the intervals by their start time first.",
      "Iterate through the sorted intervals and keep track of the current end time.",
      "If the next interval starts before the current one ends, they overlap."
    ]
  },
  'valid-parentheses': {
      id: 'valid-parentheses',
      title: 'Valid Parentheses',
      description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.

Example 1:
Input: s = "()"
Output: true

Example 2:
Input: s = "()[]{}"
Output: true

Example 3:
Input: s = "(]"
Output: false`,
      difficulty: 'Easy',
      timeLimit: 10,
      tags: ['Stack', 'String'],
      expectedComplexity: 'O(n)',
      initialCode: {
          javascript: `function isValid(s) {
  
}`,
          python: `def isValid(s):
    pass`
      },
      testCases: [
          { id: 't1', input: '"()"', expectedOutput: 'true', visible: true },
          { id: 't2', input: '"()[]{}"', expectedOutput: 'true', visible: true },
          { id: 't3', input: '"(]"', expectedOutput: 'false', visible: true },
          { id: 't4', input: '"([)]"', expectedOutput: 'false', visible: false }
      ],
      hints: ["Use a stack to keep track of open brackets."]
  }
};
