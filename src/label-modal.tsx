import Button from '@mui/joy/Button';
import DialogActions from '@mui/joy/DialogActions';
import DialogContent from '@mui/joy/DialogContent';
import DialogTitle from '@mui/joy/DialogTitle';
import Divider from '@mui/joy/Divider';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import Stack from '@mui/joy/Stack';
import * as React from 'react';
import { LabelModalResult, LabelModalState, UiState } from './types';

export function LabelModal(props: { initial: LabelModalState, dispatch: (r: LabelModalResult) => void }): JSX.Element {
  const { initial, dispatch } = props;

  const [state, setState] = React.useState<LabelModalState>(initial);
  const { text, zoom, tp } = state;

  const dismiss = () => dispatch({ t: "LabelModalCancel" });
  const submit = () => dispatch({ t: "LabelModalOk", result: state });
  function change(f: (l: LabelModalState) => LabelModalState): void {
    setState(f);
  }
  return <Modal open={true} onClose={dismiss}>
    <ModalDialog variant="outlined" role="alertdialog">
      <DialogTitle>
        Edit Label
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel>Text</FormLabel>
            <Input placeholder="Text"
              value={text} onChange={e => change(z => ({ ...z, text: e.target.value }))}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Type</FormLabel>
            <Input placeholder="Type"
              value={tp} onChange={e => change(z => ({ ...z, tp: e.target.value }))}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Zoom</FormLabel>
            <Input placeholder="Zoom"
              value={zoom} onChange={e => change(z => ({ ...z, zoom: e.target.value }))}
            />
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="solid" color="primary" onMouseDown={submit}>
          Save
        </Button>
        <Button variant="plain" color="neutral" onMouseDown={dismiss}>
          Cancel
        </Button>
      </DialogActions>
    </ModalDialog>
  </Modal >
}
