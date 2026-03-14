import { useState } from 'react';
import {
  Typography, Input, Button, Card, Collapse, Tag, Empty, message, Space, Spin,
} from 'antd';
import { SendOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { askQuestion } from '../api';
import type { QaResult } from '../types';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

export default function QaPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QaResult | null>(null);
  const [hasAsked, setHasAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q) {
      message.warning('请输入问题');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setHasAsked(true);

    try {
      const data = await askQuestion(q);
      setResult(data);
    } catch (err: any) {
      const msg = err.message || '请求失败，请稍后重试';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>知识库问答</Title>

      <Card style={{ marginBottom: 24 }}>
        <TextArea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入您的问题"
          autoSize={{ minRows: 3, maxRows: 8 }}
          disabled={loading}
          style={{ marginBottom: 12 }}
        />
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>Ctrl+Enter 提交</Text>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={loading}
              disabled={!question.trim()}
              onClick={handleSubmit}
            >
              提交
            </Button>
          </Space>
        </div>
      </Card>

      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16, color: '#888' }}>
              正在检索知识库并生成答案...
            </Paragraph>
          </div>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <Empty
            description={error}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleSubmit}>重试</Button>
          </Empty>
        </Card>
      )}

      {!loading && !error && result && (
        <Card title="回答" style={{ marginBottom: 24 }}>
          <div style={{ lineHeight: 1.8 }}>
            <ReactMarkdown>{result.answer}</ReactMarkdown>
          </div>

          {result.citations.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Collapse
                defaultActiveKey={['refs']}
                items={[
                  {
                    key: 'refs',
                    label: `参考来源（${result.citations.length} 条）`,
                    children: (
                      <div>
                        {result.citations.map((cite, idx) => (
                          <Card
                            key={cite.chunkId}
                            size="small"
                            style={{ marginBottom: idx < result.citations.length - 1 ? 8 : 0 }}
                          >
                            <Space style={{ marginBottom: 4 }}>
                              <FileTextOutlined />
                              <Text strong>{cite.filename}</Text>
                              <Tag color="blue">
                                相似度 {(cite.score * 100).toFixed(1)}%
                              </Tag>
                            </Space>
                            <Paragraph
                              type="secondary"
                              style={{ marginBottom: 0, fontSize: 13 }}
                              ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                            >
                              {cite.text}
                            </Paragraph>
                          </Card>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      )}

      {!loading && !error && !result && !hasAsked && (
        <Card>
          <Empty
            description="在上方输入问题开始提问"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
}
