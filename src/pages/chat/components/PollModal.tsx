import React, { useState } from "react";
import { Modal, Input, Button, Switch, message as toast } from "antd";
import { PlusOutlined, DeleteOutlined, BarChartOutlined } from "@ant-design/icons";

interface PollModalProps {
  open: boolean;
  onClose: () => void;
  onCreatePoll?: (pollData: { question: string; options: string[]; allowMultiple: boolean }) => void;
  onSubmit?: (question: string, options: string[], allowMultiple?: boolean) => void;
}

export const PollModal: React.FC<PollModalProps> = ({ open, onClose, onCreatePoll, onSubmit }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const addOption = () => {
    if (options.length < 8) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleCreate = () => {
    if (!question.trim()) {
      toast.error("Please enter a poll question");
      return;
    }
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      toast.error("Please provide at least 2 valid options");
      return;
    }

    if (onCreatePoll) {
      onCreatePoll({
        question: question.trim(),
        options: validOptions,
        allowMultiple,
      });
    } else if (onSubmit) {
      onSubmit(question.trim(), validOptions, allowMultiple);
    }

    setQuestion("");
    setOptions(["", ""]);
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChartOutlined style={{ color: "#1890ff" }} />
          <span>Create a Poll</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={handleCreate}
      okText="Create Poll"
      cancelText="Cancel"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
            Question
          </label>
          <Input.TextArea
            placeholder="Ask a question..."
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div>
          <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
            Options
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                />
                {options.length > 2 && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeOption(idx)}
                  />
                )}
              </div>
            ))}
          </div>

          {options.length < 8 && (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addOption}
              style={{ marginTop: 10, width: "100%" }}
            >
              Add Option
            </Button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Allow multiple answers</span>
          <Switch checked={allowMultiple} onChange={setAllowMultiple} />
        </div>
      </div>
    </Modal>
  );
};

export default PollModal;
