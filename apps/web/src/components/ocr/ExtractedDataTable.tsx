import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { OCRConfidenceIndicator } from './OCRConfidenceIndicator';
import { cn } from '@/lib/utils';
import type { TableResult, TableCell } from '@/api/document.api';

export interface ExtractedDataTableProps {
  table: TableResult;
  onCellUpdate?: (row: number, col: number, newValue: string) => void;
}

/**
 * Story 2-5: Extracted Data Table
 * Displays table data extracted from OCR with inline editing
 */
export function ExtractedDataTable({ table, onCellUpdate }: ExtractedDataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Build a 2D grid from cells
  const maxRow = Math.max(...table.cells.map(c => c.row));
  const maxCol = Math.max(...table.cells.map(c => c.col));

  const cellMap = new Map<string, TableCell>();
  table.cells.forEach(cell => {
    cellMap.set(`${cell.row}-${cell.col}`, cell);
  });

  const handleCellClick = (row: number, col: number, cell: TableCell | undefined) => {
    if (cell && onCellUpdate) {
      setEditingCell({ row, col });
      setEditValue(cell.text);
    }
  };

  const handleSave = () => {
    if (editingCell && onCellUpdate) {
      onCellUpdate(editingCell.row, editingCell.col, editValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: maxRow + 1 }, (_, rowIdx) => (
            <tr key={rowIdx} className={cn(rowIdx === 0 && 'bg-gray-50 font-medium')}>
              {Array.from({ length: maxCol + 1 }, (_, colIdx) => {
                const cell = cellMap.get(`${rowIdx}-${colIdx}`);
                const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;

                return (
                  <td
                    key={colIdx}
                    className={cn(
                      'border-b border-r px-3 py-2 cursor-pointer hover:bg-gray-50',
                      cell && cell.confidence < 70 && 'bg-red-50'
                    )}
                    onClick={() => handleCellClick(rowIdx, colIdx, cell)}
                  >
                    {isEditing ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        autoFocus
                        className="h-7 text-sm"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex-1">{cell?.text || ''}</span>
                        {cell && cell.confidence < 90 && (
                          <OCRConfidenceIndicator confidence={cell.confidence} size="sm" />
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
        Page {table.page}
      </div>
    </div>
  );
}
