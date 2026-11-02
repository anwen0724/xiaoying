import { TaskScope } from '../../features/tasks/TaskScope';
import { TaskHistory } from '../../features/tasks/TaskHistory';

export default function HistoryPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>我的制作记录</h1>
          <p className="subtitle">查看不同模板的任务、进度与制作结果。</p>
        </div>
      </div>
      <TaskScope><TaskHistory /></TaskScope>
    </>
  );
}
