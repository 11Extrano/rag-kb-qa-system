import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { QuestionCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import QaPage from './pages/QaPage';
import DocumentsPage from './pages/DocumentsPage';

const { Header, Content } = Layout;

const menuItems = [
  { key: '/qa', icon: <QuestionCircleOutlined />, label: <Link to="/qa">知识库问答</Link> },
  { key: '/admin/documents', icon: <FileTextOutlined />, label: <Link to="/admin/documents">文档管理</Link> },
];

export default function App() {
  const location = useLocation();

  const selectedKey = location.pathname.startsWith('/admin') ? '/admin/documents' : '/qa';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginRight: 40, whiteSpace: 'nowrap' }}>
          RAG 知识库问答
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Content style={{ padding: '24px 48px' }}>
        <Routes>
          <Route path="/" element={<QaPage />} />
          <Route path="/qa" element={<QaPage />} />
          <Route path="/admin/documents" element={<DocumentsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}
